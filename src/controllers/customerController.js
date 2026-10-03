import Customer from '../models/Customer.js';
import Loan from '../models/Loan.js';

export async function listCustomers(req, res) {
  const customers = await Customer.find().sort({ createdAt: -1 });
  res.json(customers);
}
export async function createCustomer(req, res) {
  try { res.status(201).json(await Customer.create(req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
}
export async function updateCustomer(req, res) {
  try {
    const c = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json(c);
  } catch (e) { res.status(400).json({ message: e.message }); }
}
export async function deleteCustomer(req, res) {
  try {
    const count = await Loan.countDocuments({ customer: req.params.id, status: 'Active' });
    if (count) return res.status(400).json({ message: 'Cannot delete a customer with an active loan' });
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer deleted' });
  } catch (e) { res.status(400).json({ message: e.message }); }
}
