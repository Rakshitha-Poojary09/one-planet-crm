import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';

dotenv.config();

const testLogin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');

    const users = await User.find({}).select('+password');
    console.log(`Found ${users.length} users in database:`);
    for (const u of users) {
      console.log(`- Role: ${u.role}, Email: '${u.email}', Status: ${u.employmentStatus}`);
      const testMatchAdmin = await u.comparePassword('AdminPassword123!');
      const testMatchEmp = await u.comparePassword('EmployeePassword123!');
      const testMatchMgr = await u.comparePassword('ManagerPassword123!');
      console.log(`  Password matches: AdminPassword123!=${testMatchAdmin}, ManagerPassword123!=${testMatchMgr}, EmployeePassword123!=${testMatchEmp}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

testLogin();
