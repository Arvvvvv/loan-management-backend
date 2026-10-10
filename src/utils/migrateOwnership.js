import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Loan from '../models/Loan.js';

export async function migrateLegacyOwnership() {
  const username = (process.env.LEGACY_OWNER_USERNAME || 'Arvayne').trim();
  if (!username) return;
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const owner = await User.findOne({ username: { $regex: `^${escaped}$`, $options: 'i' } });
  if (!owner) {
    console.log(`[ownership] Legacy owner '${username}' not found. No legacy records were changed.`);
    return;
  }
  const customers = await Customer.updateMany({ $or: [{ ownerUser: { $exists: false } }, { ownerUser: null }] }, { $set: { ownerUser: owner._id } });
  const loans = await Loan.updateMany({ $or: [{ ownerUser: { $exists: false } }, { ownerUser: null }] }, { $set: { ownerUser: owner._id } });
  console.log(`[ownership] Legacy migration assigned ${customers.modifiedCount || 0} customers and ${loans.modifiedCount || 0} loans to '${owner.username}'.`);
}
