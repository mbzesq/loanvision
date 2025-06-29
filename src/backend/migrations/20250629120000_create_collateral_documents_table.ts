import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('collateral_documents', (table) => {
        table.increments('id').primary();
        table.text('loan_id').notNullable();
        table.text('file_name').notNullable();
        table.text('storage_path').notNullable().comment('Path in cloud storage bucket');
        table.text('document_type').nullable().comment('Label predicted by Python model');
        table.integer('page_count').nullable();
        table.timestamp('uploaded_at').defaultTo(knex.fn.now());
        
        // Foreign key constraint
        table.foreign('loan_id')
             .references('loan_id')
             .inTable('daily_metrics_current')
             .onDelete('CASCADE');
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('collateral_documents');
}