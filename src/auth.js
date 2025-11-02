const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class AuthService {
  constructor(store, options = {}) {
    this.store = store;
    this.jwtSecret = options.jwtSecret || 'dev_secret_change_me';
    this.cookieName = options.cookieName || 'auth';
    this.cookieSecure = options.cookieSecure ?? false; // set true in prod HTTPS
  }

  seedAdmin() {
    const db = this.store.read();
    const exists = db.users.find(u => u.email === 'admin@admin.com');
    if (!exists) {
      const passwordHash = bcrypt.hashSync('111', 10);
      db.users.push({
        id: uuidv4(),
        email: 'admin@admin.com',
        passwordHash,
        role: 'admin',
        usage: { used: 0, limit: 20 }
      });
      this.store.write(db);
      // eslint-disable-next-line no-console
      console.log('Seeded admin user admin@admin.com / 111');
    }
  }

  register(email, password) {
    const db = this.store.read();
    const exists = db.users.find(u => u.email === email);
    if (exists) throw new Error('Email already registered');
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = {
      id: uuidv4(),
      email,
      passwordHash,
      role: 'user',
      usage: { used: 0, limit: 20 }
    };
    db.users.push(user);
    this.store.write(db);
    return { id: user.id, email: user.email, role: user.role };
  }

  login(email, password) {
    const db = this.store.read();
    const user = db.users.find(u => u.email === email);
    if (!user) throw new Error('Invalid credentials');
    const ok = bcrypt.compareSync(password, user.passwordHash);
    if (!ok) throw new Error('Invalid credentials');
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, this.jwtSecret, { expiresIn: '2h' });
    return { token, user };
  }

  verify(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (e) {
      return null;
    }
  }

  cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/',
      maxAge: 2 * 60 * 60 * 1000
    };
  }
}

module.exports = AuthService;

