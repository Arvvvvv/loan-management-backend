import Customer from '../models/Customer.js';
import Loan from '../models/Loan.js';

export async function listCustomers(req, res) {
  const customers = await Customer.find({ ownerUser: req.user.id }).sort({ createdAt: -1 });
  res.json(customers);
}

export async function createCustomer(req, res) {
  try {
    // Never accept an ownerUser supplied by the client. The authenticated
    // account is always the owner of a newly created customer.
    const { ownerUser, ...clientData } = req.body || {};
    const data = { ...clientData, ownerUser: req.user.id };
    res.status(201).json(await Customer.create(data));
  } catch (e) { res.status(400).json({ message: e.message }); }
}

export async function updateCustomer(req, res) {
  try {
    // Never allow a request body to transfer a customer to another account.
    const { ownerUser, ...clientData } = req.body || {};
    const c = await Customer.findOneAndUpdate(
      { _id: req.params.id, ownerUser: req.user.id },
      clientData,
      { new: true, runValidators: true }
    );
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json(c);
  } catch (e) { res.status(400).json({ message: e.message }); }
}

export async function deleteCustomer(req, res) {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, ownerUser: req.user.id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    const count = await Loan.countDocuments({ customer: customer._id, ownerUser: req.user.id, status: 'Active' });
    if (count) return res.status(400).json({ message: 'Cannot delete a customer with an active loan' });
    await Customer.deleteOne({ _id: customer._id, ownerUser: req.user.id });
    res.json({ message: 'Customer deleted' });
  } catch (e) { res.status(400).json({ message: e.message }); }
}
