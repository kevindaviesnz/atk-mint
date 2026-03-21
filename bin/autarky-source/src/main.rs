use std::fs;
use std::collections::HashMap;
use serde_json::json;
use clap::Parser;
use ed25519_dalek::{SigningKey, Signer, VerifyingKey};
use rand::RngCore;
use std::time::{SystemTime, UNIX_EPOCH};
use std::io::{Write, Read};
use std::env;

mod ast;
mod parser;
mod typecheck;
mod ir;
mod vm;
mod codegen;

#[derive(Parser, Debug)]
#[command(author, version, about = "Autarky Compiler", long_about = None)]
struct Args {
    #[arg(short, long)]
    file: String,
    #[arg(long, default_value_t = true)]
    json: bool,
    #[arg(long, default_value_t = 0)]
    compute: i64,
    #[arg(long, default_value_t = 0)]
    credits: i64,
    #[arg(long, default_value_t = 0)]
    nonce: u64,
}

fn get_sovereign_key() -> SigningKey {
    // Priority 1: Environment Variable (Production/Cloud Security)
    if let Ok(hex_key) = env::var("AUTARKY_COMPILER_SECRET") {
        let bytes = hex::decode(hex_key.trim())
            .expect("AUTARKY_COMPILER_SECRET must be a valid hex string");
        let array: [u8; 32] = bytes.try_into()
            .expect("AUTARKY_COMPILER_SECRET must be 32 bytes (64 hex chars)");
        return SigningKey::from_bytes(&array);
    }

    // Priority 2: Local File (Development/Local fallback)
    let key_path = "autarky.key";
    if let Ok(mut file) = fs::File::open(key_path) {
        let mut bytes = [0u8; 32];
        file.read_exact(&mut bytes).expect("Read failed");
        SigningKey::from_bytes(&bytes)
    } else {
        let mut seed = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut seed);
        let mut file = fs::File::create(key_path).expect("Create failed");
        file.write_all(&seed).expect("Write failed");
        SigningKey::from_bytes(&seed)
    }
}

fn main() {
    let args = Args::parse();
    let source = fs::read_to_string(&args.file).unwrap();
    let mut parser = parser::Parser::new(&source);
    let mut ast = parser.parse().unwrap();

    // Resource Injection
    ast = ast::Expr::App {
        func: Box::new(ast::Expr::Lambda {
            param: "SYS_COMPUTE".to_string(),
            param_type: ast::Type::Int,
            body: Box::new(ast::Expr::App {
                func: Box::new(ast::Expr::Lambda {
                    param: "SYS_CREDITS".to_string(),
                    param_type: ast::Type::Int,
                    body: Box::new(ast),
                }),
                arg: Box::new(ast::Expr::IntLiteral(args.credits)),
            }),
        }),
        arg: Box::new(ast::Expr::IntLiteral(args.compute)),
    };

    // Type Check & Execute
    let checker = typecheck::TypeChecker::new();
    let (final_type, _) = checker.check(HashMap::new(), &ast).unwrap();
    let ir_root = ir::erase_proofs(&ast);
    let mut machine = vm::VirtualMachine::new();
    let vm_res = machine.evaluate(&HashMap::new(), &ir_root).unwrap();

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let final_payload = json!({
        "status": "success",
        "vm_result": format!("{:?}", vm_res),
        "nonce": args.nonce,
        "timestamp": now
    }).to_string();

    let signing_key = get_sovereign_key();
    let signature = signing_key.sign(final_payload.as_bytes());
    let verifying_key: VerifyingKey = signing_key.verifying_key();

    println!("{}", json!({
        "payload": final_payload,
        "proof_signature": hex::encode(signature.to_bytes()),
        "signer_pubkey": hex::encode(verifying_key.to_bytes())
    }));
}