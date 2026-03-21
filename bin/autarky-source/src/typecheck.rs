use std::collections::{HashMap, HashSet};
use crate::ast::{Expr, Type};

pub struct TypeChecker {}

impl TypeChecker {
    pub fn new() -> Self {
        Self {}
    }

    pub fn check(
        &self,
        env: HashMap<String, Type>,
        expr: &Expr,
    ) -> Result<(Type, HashSet<String>), String> {
        match expr {
            Expr::IntLiteral(_) => Ok((Type::Int, HashSet::new())),
            Expr::FloatLiteral(_) => Ok((Type::Float, HashSet::new())),

            Expr::Variable(name) => {
                if let Some(t) = env.get(name) {
                    let mut used = HashSet::new();
                    used.insert(name.clone());
                    Ok((t.clone(), used))
                } else {
                    Err(format!("Type Error: Undefined variable '{}'", name))
                }
            }

            Expr::Add(l, r) | Expr::Sub(l, r) | Expr::Mul(l, r) | Expr::Div(l, r) => {
                let (lt, l_used) = self.check(env.clone(), l)?;
                let (rt, r_used) = self.check(env, r)?;

                if !l_used.is_disjoint(&r_used) {
                    let intersection: Vec<_> = l_used.intersection(&r_used).collect();
                    return Err(format!("Linear Error: Variable(s) {:?} used twice in math operation", intersection));
                }

                let mut total_used = l_used;
                total_used.extend(r_used);
                Ok((lt, total_used))
            }

            Expr::Lambda { param, param_type, body } => {
                let mut new_env = env.clone();
                // FIXED: Just dereference once to get the Type out of the Box
                new_env.insert(param.clone(), (*param_type).clone());
                
                let (body_type, mut body_used) = self.check(new_env, body)?;

                if !body_used.remove(param) {
                    return Err(format!("Linear Error: Parameter '{}' is never consumed. Resources must be used.", param));
                }

                // FIXED: Wrapped the first argument in Box::new to match Type::Func(Box<Type>, Box<Type>)
                Ok((Type::Func(Box::new((*param_type).clone()), Box::new(body_type)), body_used))
            }

            Expr::App { func, arg } => {
                let (ft, f_used) = self.check(env.clone(), func)?;
                let (at, a_used) = self.check(env, arg)?;

                if let Type::Func(param_type, ret_type) = ft {
                    if *param_type != at {
                        return Err(format!("Type Error: Expected {:?}, got {:?}", param_type, at));
                    }
                    if !f_used.is_disjoint(&a_used) {
                        return Err("Linear Error: Double spend detected in application".into());
                    }
                    let mut total_used = f_used;
                    total_used.extend(a_used);
                    Ok((*ret_type, total_used))
                } else {
                    Err("Type Error: Attempted to call a non-function".into())
                }
            }

            Expr::MkPair(l, r) => {
                let (lt, l_used) = self.check(env.clone(), l)?;
                let (rt, r_used) = self.check(env, r)?;

                if !l_used.is_disjoint(&r_used) {
                    return Err("Linear Error: Double spend in Pair creation".into());
                }

                let mut total_used = l_used;
                total_used.extend(r_used);
                Ok((Type::Pair(Box::new(lt), Box::new(rt)), total_used))
            }

            Expr::Unpack { var1, var2, pair, body } => {
                let (pt, p_used) = self.check(env.clone(), pair)?;
                
                if let Type::Pair(t1, t2) = pt {
                    let mut new_env = env;
                    new_env.insert(var1.clone(), *t1.clone());
                    new_env.insert(var2.clone(), *t2.clone());
                    
                    let (body_type, mut body_used) = self.check(new_env, body)?;
                    
                    if !body_used.remove(var1) || !body_used.remove(var2) {
                        return Err(format!("Linear Error: Unpacked variables '{}' or '{}' not consumed", var1, var2));
                    }

                    let mut total_used = p_used;
                    total_used.extend(body_used);
                    Ok((body_type, total_used))
                } else {
                    Err("Type Error: Cannot unpack a non-pair type".into())
                }
            }

            Expr::Match { expr, left_var, left_body, right_var, right_body } => {
                let (et, e_used) = self.check(env.clone(), expr)?;

                if let Type::Either(lt, rt) = et {
                    let mut env_l = env.clone();
                    env_l.insert(left_var.clone(), *lt);
                    let (type_l, mut used_l) = self.check(env_l, left_body)?;
                    used_l.remove(left_var);

                    let mut env_r = env;
                    env_r.insert(right_var.clone(), *rt);
                    let (type_r, mut used_r) = self.check(env_r, right_body)?;
                    used_r.remove(right_var);

                    if type_l != type_r {
                        return Err("Type Error: Match branches must return same type".into());
                    }
                    
                    if used_l != used_r {
                        return Err("Linear Error: Match branches consume different resource sets.".into());
                    }

                    let mut total_used = e_used;
                    total_used.extend(used_l);
                    Ok((type_l, total_used))
                } else {
                    Err("Type Error: Match requires an Either type".into())
                }
            }
            
            Expr::Left(pair, _) | Expr::Right(pair, _) => {
                let (pt, p_used) = self.check(env, pair)?;
                if let Type::Pair(lt, rt) = pt {
                    let is_left = matches!(expr, Expr::Left(..));
                    let ret_type = if is_left { *lt } else { *rt };
                    Ok((ret_type, p_used))
                } else {
                    Err("Type Error: Projection requires a Pair".into())
                }
            }
            
            Expr::Eq { left, right } => {
                let (_, l_used) = self.check(env.clone(), left)?;
                let (_, r_used) = self.check(env, right)?;
                let mut total = l_used;
                total.extend(r_used);
                Ok((Type::Int, total))
            }
        }
    }
}