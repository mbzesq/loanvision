import pool from '../db';

async function seedInboxData() {
  try {
    console.log('🌱 Seeding inbox with sample data...');
    
    // Get existing users
    const usersResult = await pool.query('SELECT id, email, first_name, last_name FROM users ORDER BY id LIMIT 2');
    const users = usersResult.rows;
    
    if (users.length < 2) {
      console.log('⚠️ Need at least 2 users to seed inbox data. Please create users first.');
      return;
    }
    
    const [admin, user] = users;
    console.log(`👥 Using users: ${admin.email} (ID: ${admin.id}) and ${user.email} (ID: ${user.id})`);
    
    // Get some sample loan IDs
    const loansResult = await pool.query('SELECT loan_id FROM daily_metrics_current LIMIT 10');
    const loanIds = loansResult.rows.map(row => row.loan_id);
    
    if (loanIds.length === 0) {
      console.log('⚠️ No loans found. Creating inbox items without loan context.');
    }
    
    // Sample inbox items
    const sampleItems = [
      {
        type: 'system_alert',
        subject: 'SOL Expiring Within 30 Days',
        body: '12 loans approaching statute of limitations deadline. Immediate action required to prevent loss of collection rights.',
        priority: 'urgent',
        category: 'sol',
        created_by_user_id: admin.id,
        loan_ids: loanIds.slice(0, 5),
        source: 'system'
      },
      {
        type: 'user_message',
        subject: 'Review needed: Foreclosure timeline for Loan #' + (loanIds[0] || 'L001'),
        body: `@${user.first_name || 'user'} can you review the foreclosure timeline for loan ${loanIds[0] || 'L001'}? The title seems to have some issues that might delay the process.`,
        priority: 'high',
        category: 'legal',
        created_by_user_id: admin.id,
        assigned_to_user_id: user.id,
        loan_ids: loanIds.slice(0, 1),
        thread_id: 'thread_foreclosure_review_001',
        source: 'user'
      },
      {
        type: 'task_assignment',
        subject: 'Upload missing mortgage documentation',
        body: 'Please obtain and upload missing mortgage documentation for 5 loans. Required for SOL compliance review.',
        priority: 'high',
        category: 'document',
        created_by_user_id: admin.id,
        assigned_to_user_id: user.id,
        loan_ids: loanIds.slice(5, 10),
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        estimated_duration: 120, // 2 hours
        source: 'user'
      },
      {
        type: 'loan_update',
        subject: 'Payment received: Loan #' + (loanIds[1] || 'L002'),
        body: `Unexpected payment of $2,450.00 received for loan ${loanIds[1] || 'L002'}. Please review payment allocation and update loan status.`,
        priority: 'normal',
        category: 'payment',
        created_by_user_id: admin.id,
        loan_ids: loanIds.slice(1, 2),
        source: 'api',
        status: 'read'
      },
      {
        type: 'system_notification',
        subject: 'Daily Portfolio Summary Available',
        body: `Your daily portfolio summary for ${new Date().toLocaleDateString()} is now available. Review performance metrics and new alerts.`,
        priority: 'low',
        created_by_user_id: admin.id,
        source: 'system',
        status: 'read'
      }
    ];
    
    // Insert sample items
    for (const item of sampleItems) {
      const insertQuery = `
        INSERT INTO inbox_items (
          type, subject, body, priority, category, status, source,
          created_by_user_id, assigned_to_user_id, thread_id, 
          loan_ids, due_date, estimated_duration,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, external_id
      `;
      
      const values = [
        item.type,
        item.subject,
        item.body,
        item.priority,
        item.category,
        item.status || 'unread',
        item.source,
        item.created_by_user_id,
        item.assigned_to_user_id || null,
        item.thread_id || null,
        item.loan_ids || null,
        item.due_date || null,
        item.estimated_duration || null,
        new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) // Random time in last 24 hours
      ];
      
      const result = await pool.query(insertQuery, values);
      console.log(`✅ Created inbox item: ${item.subject} (ID: ${result.rows[0].id})`);
    }
    
    // Create a threaded conversation
    const threadId = 'thread_foreclosure_review_001';
    
    // First message already created above, now add replies
    const threadReplies = [
      {
        type: 'user_message',
        subject: 'Re: Review needed: Foreclosure timeline for Loan #' + (loanIds[0] || 'L001'),
        body: `@${admin.first_name || 'admin'} I reviewed the title. There are indeed some issues with the chain of ownership. The deed from 2019 has a missing notarization. Should we request a corrected deed or proceed with title insurance?`,
        priority: 'high',
        category: 'legal',
        created_by_user_id: user.id,
        thread_id: threadId,
        loan_ids: loanIds.slice(0, 1),
        source: 'user',
        status: 'read'
      },
      {
        type: 'user_message',
        subject: 'Re: Review needed: Foreclosure timeline for Loan #' + (loanIds[0] || 'L001'),
        body: `@${user.first_name || 'user'} Let's proceed with title insurance for now to avoid delays. Can you contact our title company and get a quote? We need to move on this quickly.`,
        priority: 'high',
        category: 'legal',
        created_by_user_id: admin.id,
        assigned_to_user_id: user.id,
        thread_id: threadId,
        loan_ids: loanIds.slice(0, 1),
        source: 'user'
      }
    ];
    
    for (const reply of threadReplies) {
      const insertQuery = `
        INSERT INTO inbox_items (
          type, subject, body, priority, category, status, source,
          created_by_user_id, assigned_to_user_id, thread_id, 
          loan_ids, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;
      
      const values = [
        reply.type,
        reply.subject,
        reply.body,
        reply.priority,
        reply.category,
        reply.status || 'unread',
        reply.source,
        reply.created_by_user_id,
        reply.assigned_to_user_id || null,
        reply.thread_id,
        reply.loan_ids || null,
        new Date(Date.now() - Math.random() * 60 * 60 * 1000) // Random time in last hour
      ];
      
      const result = await pool.query(insertQuery, values);
      console.log(`💬 Added thread reply: ${reply.subject} (ID: ${result.rows[0].id})`);
    }
    
    // Add some recipients for multi-user messages
    const multiUserMessage = await pool.query(`
      INSERT INTO inbox_items (
        type, subject, body, priority, category, source,
        created_by_user_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      'user_message',
      'Weekly Portfolio Review Meeting',
      'Please join us for the weekly portfolio review meeting tomorrow at 2 PM. We\'ll be discussing performance metrics and upcoming SOL deadlines.',
      'normal',
      'meeting',
      'user',
      admin.id,
      new Date()
    ]);
    
    const messageId = multiUserMessage.rows[0].id;
    
    // Add recipients
    await pool.query(`
      INSERT INTO inbox_recipients (inbox_item_id, user_id, recipient_type)
      VALUES ($1, $2, $3)
    `, [messageId, user.id, 'to']);
    
    console.log(`📧 Created multi-user message with recipients`);
    
    console.log('✅ Inbox seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Created ${sampleItems.length + threadReplies.length + 1} inbox items`);
    console.log(`   - 1 threaded conversation with ${threadReplies.length + 1} messages`);
    console.log(`   - 1 multi-user message with recipients`);
    console.log(`   - Mixed priorities: urgent, high, normal, low`);
    console.log(`   - Various categories: sol, legal, document, payment, meeting`);
    
  } catch (error) {
    console.error('❌ Error seeding inbox data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedInboxData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedInboxData };