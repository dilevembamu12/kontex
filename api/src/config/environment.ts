/// @anchor: dotenv — https://github.com/motdotla/dotenv#readme
/// @anchor: PROJECT_CONTEXT.md §3.1 — PostgreSQL+pgvector, Redis
/// Gère le chargement et la validation des variables d'environnement.
/// Principe TTC E2 : fonctions pures (getEnvironment est déterministe).
/// Principe TTC E3 : pas de catch vide, arrêt immédiat si variable critique manquante.

import { config } from 'dotenv';

// Charge le fichier .env correspondant à l'environnement
config({ path: process.env['NODE_ENV'] === 'production' ? '.env.production' : '.env' });

/**
 * Retourne une variable d'environnement obligatoire.
 * @side-effect: process.exit(1) si la variable est absente (arrêt sécurisé).
 */
function requireEnvironmentVariable(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    console.error(`[KontEx::Config] Variable d'environnement critique absente : ${key}`);
    process.exit(1);
  }
  return value;
}

/**
 * Retourne une variable d'environnement optionnelle avec une valeur par défaut.
 * Fonction pure — pas d'effet de bord.
 */
function optionalEnvironmentVariable(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value;
}

/// @anchor: PROJECT_CONTEXT.md §3.1 — PostgreSQL + pgvector pour le Context Store
export interface Environment {
  readonly NODE_ENV: 'development' | 'production' | 'test';
  readonly PORT: number;
  readonly DATABASE_URL: string;
  readonly REDIS_URL: string;
  readonly CORS_ORIGIN: string;
  readonly LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

export const environment: Environment = {
  NODE_ENV: optionalEnvironmentVariable('NODE_ENV', 'development') as Environment['NODE_ENV'],
  PORT: Number.parseInt(optionalEnvironmentVariable('PORT', '3000'), 10),
  DATABASE_URL: requireEnvironmentVariable('DATABASE_URL'),
  REDIS_URL: requireEnvironmentVariable('REDIS_URL'),
  CORS_ORIGIN: optionalEnvironmentVariable('CORS_ORIGIN', 'http://localhost:5173'),
  LOG_LEVEL: optionalEnvironmentVariable('LOG_LEVEL', 'info') as Environment['LOG_LEVEL'],
} as const;
