#!/usr/bin/env tsx
/**
 * Debug RAG Reindex Script
 * Run with: npx tsx debug_rag_reindex.ts
 * 
 * This script provides verbose debugging output to understand
 * why the RAG reindex is not working properly in production.
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { RAGIndexingService } from './src/services/ragIndexingService';

// Load environment variables
dotenv.config();

async function debugRAGReindex() {
  console.log('🔍 Starting RAG reindex debug session...');
  
  // Check environment variables
  console.log('\n📋 Environment Check:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
  
  // Create database connection
  let pool: Pool;
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection established');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
  
  try {
    // Check current RAG status
    console.log('\n📊 Current RAG Status:');
    const ragService = new RAGIndexingService(pool);
    
    const health = await ragService.healthCheck();
    console.log('Health check:', health);
    
    const stats = await ragService.getIndexStats();
    console.log('Current stats:', stats);
    
    // Check table existence
    console.log('\n🗃️ Database Tables Check:');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'rag_%'
      ORDER BY table_name
    `);
    console.log('RAG tables found:', tableCheck.rows.map(r => r.table_name));
    
    // Check current document count
    const docCount = await pool.query('SELECT COUNT(*) as count FROM rag_loan_documents');
    console.log(`Current document count: ${docCount.rows[0].count}`);
    
    // Check document types
    const typeCount = await pool.query(`
      SELECT metadata->>'type' as doc_type, COUNT(*) as count
      FROM rag_loan_documents 
      GROUP BY metadata->>'type'
      ORDER BY count DESC
    `);
    console.log('Document types:', typeCount.rows);
    
    // Check data availability for new document types
    console.log('\n📋 Source Data Check:');
    
    const tablesToCheck = [
      'monthly_cashflow_data',
      'chain_of_title', 
      'loan_collateral_status'
    ];
    
    for (const table of tablesToCheck) {
      try {
        const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ ${table}: ${count.rows[0].count} records`);
      } catch (error) {
        console.log(`❌ ${table}: table does not exist`);
      }
    }
    
    console.log('\n🚀 Starting RAG reindex with verbose logging...');
    
    // Run the reindex with detailed logging
    const startTime = Date.now();
    const indexStats = await ragService.rebuildIndex();
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ RAG reindex completed in ${duration}ms`);
    console.log('Final stats:', JSON.stringify(indexStats, null, 2));
    
    // Verify the results
    console.log('\n🔍 Verification:');
    const newDocCount = await pool.query('SELECT COUNT(*) as count FROM rag_loan_documents');
    console.log(`New document count: ${newDocCount.rows[0].count}`);
    
    const newTypeCount = await pool.query(`
      SELECT metadata->>'type' as doc_type, COUNT(*) as count
      FROM rag_loan_documents 
      GROUP BY metadata->>'type'
      ORDER BY count DESC
    `);
    console.log('New document types:', newTypeCount.rows);
    
    // Test a sample query
    console.log('\n🧪 Testing Sample Query:');
    const sampleDocs = await pool.query(`
      SELECT id, loan_id, metadata->>'type' as doc_type, 
             SUBSTR(content, 1, 100) as content_preview
      FROM rag_loan_documents 
      LIMIT 5
    `);
    console.log('Sample documents:');
    sampleDocs.rows.forEach(doc => {
      console.log(`- ${doc.id} (${doc.doc_type}): ${doc.content_preview}...`);
    });
    
  } catch (error) {
    console.error('❌ RAG reindex debug failed:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
  } finally {
    await pool.end();
    console.log('\n🔚 Debug session completed');
  }
}

// Run the debug script
if (require.main === module) {
  debugRAGReindex().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}