const db = require('../db');
const { getCache, setCache, clearCache } = require('../utils/redisCache');
const { ROLES } = require('../config/roles');

class User {
  static async create(username, password, email, google_id = null, apple_id = null, role = ROLES.CANDIDATE) {
    const query = `
      INSERT INTO users (username, email, password, google_id, apple_id, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, role, created_at;
    `;
    const values = [username, email, password, google_id, apple_id, role];
    const { rows } = await db.query(query, values);
    
    if (rows[0]) {
      if (username) await setCache(`user_username_${username}`, rows[0]);
      if (email) await setCache(`user_email_${email}`, rows[0]);
    }
    
    return rows[0];
  }

  static async findByUsername(username) {
    const cachedUser = await getCache(`user_username_${username}`);
    if (cachedUser) return cachedUser;

    const query = `SELECT id, username, email, password, role, created_at FROM users WHERE username = $1;`;
    const { rows } = await db.query(query, [username]);
    
    if (rows[0]) {
      await setCache(`user_username_${username}`, rows[0]);
    }
    return rows[0];
  }

  static async findByEmail(email) {
    const cachedUser = await getCache(`user_email_${email}`);
    if (cachedUser) return cachedUser;

    const query = `SELECT id, username, email, password, role, created_at FROM users WHERE email = $1;`;
    const { rows } = await db.query(query, [email]);
    
    if (rows[0]) {
      await setCache(`user_email_${email}`, rows[0]);
    }
    return rows[0];
  }

  static async findById(id) {
    const query = `SELECT id, username, email, role, google_id, created_at FROM users WHERE id = $1;`;
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  static async findByGoogleId(googleId) {
    const query = `SELECT id, username, email, role, google_id FROM users WHERE google_id = $1;`;
    const { rows } = await db.query(query, [googleId]);
    return rows[0];
  }

  /**
   * Admin: List all users with pagination
   */
  static async findAll(limit = 50, offset = 0) {
    const query = `
      SELECT id, username, email, role, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2;
    `;
    const { rows } = await db.query(query, [limit, offset]);
    return rows;
  }

  /**
   * Admin: Permanent user removal
   */
  static async delete(userId) {
    const user = await this.findById(userId);
    if (!user) return false;

    const query = `DELETE FROM users WHERE id = $1;`;
    await db.query(query, [userId]);

    // Invalidate caches
    await clearCache(`user_username_${user.username}`);
    await clearCache(`user_email_${user.email}`);
    
    return true;
  }

  /**
   * Admin: Explicitly set a user's role
   */
  static async updateRole(userId, newRole) {
    if (!Object.values(ROLES).includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }

    const query = `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, email, role;`;
    const { rows } = await db.query(query, [newRole, userId]);

    if (rows[0]) {
      // Invalidate caches to force refresh on next login/check
      await clearCache(`user_username_${rows[0].username}`);
      await clearCache(`user_email_${rows[0].email}`);
    }

    return rows[0];
  }

  /**
   * Link a Google ID to an existing user account
   */
  static async linkGoogleAccount(userId, googleId) {
    const query = `UPDATE users SET google_id = $1 WHERE id = $2 RETURNING *;`;
    const { rows } = await db.query(query, [googleId, userId]);
    
    if (rows[0]) {
      await clearCache(`user_username_${rows[0].username}`);
      await clearCache(`user_email_${rows[0].email}`);
    }
    
    return rows[0];
  }
}

module.exports = User;
