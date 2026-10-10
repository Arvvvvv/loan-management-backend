import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  installment: Number,
  dueDate: Date,
  amount: Number,
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['Pending', 'Partial', 'Paid'], default: 'Pending' },
  paidAt: Date
}, { _id: true });

const loanSchema = new mongoose.Schema({
  ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  principal: { type: Number, required: true, min: 0 },
  interestType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  interestValue: { type: Number, required: true, min: 0 },
  interestAmount: { type: Number, required: true, min: 0 },
  totalPayable: { type: Number, required: true, min: 0 },
  termCount: { type: Number, required: true, min: 1 },
  termUnit: { type: String, enum: ['days', 'months'], default: 'months' },
  frequency: { type: String, enum: ['15days', 'weekly', 'monthly', 'custom'], default: '15days' },
  customDays: { type: Number, min: 1 },
  startDate: { type: Date, required: true },
  status: { type: String, enum: ['Active', 'Completed'], default: 'Active' },
  payments: [paymentSchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Loan', loanSchema);
