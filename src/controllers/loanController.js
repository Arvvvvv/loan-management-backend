import Loan from '../models/Loan.js';
import Customer from '../models/Customer.js';

function addPeriod(date, frequency, customDays) {
  const d = new Date(date);
  if (frequency === '15days') d.setDate(d.getDate() + 15);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'custom') d.setDate(d.getDate() + Number(customDays || 1));
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function installmentsFor(termCount, termUnit, frequency, customDays) {
  if (frequency === '15days') return termUnit === 'months' ? Math.max(1, Math.round(Number(termCount) * 2)) : Math.max(1, Math.ceil(Number(termCount) / 15));
  if (frequency === 'weekly') return termUnit === 'months' ? Math.max(1, Math.round(Number(termCount) * 4.345)) : Math.max(1, Math.ceil(Number(termCount) / 7));
  if (frequency === 'monthly') return termUnit === 'months' ? Number(termCount) : Math.max(1, Math.ceil(Number(termCount) / 30));
  const days = Number(termUnit === 'months' ? termCount * 30 : termCount);
  return Math.max(1, Math.ceil(days / Number(customDays || 1)));
}

function buildPayments(total, count, startDate, frequency, customDays) {
  const base = Math.floor((total / count) * 100) / 100;
  const payments = [];
  let remainder = Number((total - base * count).toFixed(2));
  let due = new Date(startDate);
  for (let i = 1; i <= count; i++) {
    due = addPeriod(due, frequency, customDays);
    const amount = Number((base + (i === count ? remainder : 0)).toFixed(2));
    payments.push({ installment: i, dueDate: due, amount, paidAmount: 0, status: 'Pending' });
  }
  return payments;
}

function calculateInterest(principal, type, value) {
  return type === 'percentage' ? Number((principal * value / 100).toFixed(2)) : Number(value || 0);
}

export async function listLoans(req, res) {
  const loans = await Loan.find().populate('customer').sort({ createdAt: -1 });
  res.json(loans);
}

export async function createLoan(req, res) {
  try {
    const { borrowerName, customer, principal, interestType = 'fixed', interestValue, termCount, termUnit = 'months', frequency = '15days', customDays, startDate } = req.body;
    if ((!customer && !borrowerName?.trim()) || !principal || interestValue === undefined || interestValue === null || Number(interestValue) < 0 || !termCount) return res.status(400).json({ message: 'Borrower name, loan amount, interest, and months to pay are required' });

    let customerId = customer;
    if (!customerId) {
      const name = borrowerName.trim();
      let borrower = await Customer.findOne({ name });
      if (!borrower) borrower = await Customer.create({ name });
      customerId = borrower._id;
    } else if (!(await Customer.exists({ _id: customerId }))) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const effectiveStartDate = startDate || new Date().toISOString().slice(0, 10);
    if (frequency === 'custom' && !customDays) return res.status(400).json({ message: 'Custom days are required' });
    const interestAmount = calculateInterest(Number(principal), interestType, Number(interestValue));
    const totalPayable = Number((Number(principal) + interestAmount).toFixed(2));
    const count = installmentsFor(Number(termCount), termUnit, frequency, customDays);
    const payments = buildPayments(totalPayable, count, effectiveStartDate, frequency, customDays);
    const loan = await Loan.create({ customer: customerId, principal, interestType, interestValue, interestAmount, totalPayable, termCount, termUnit, frequency, customDays, startDate: effectiveStartDate, payments });
    res.status(201).json(await loan.populate('customer'));
  } catch (e) { res.status(400).json({ message: e.message }); }
}

export async function recordPayment(req, res) {
  try {
    const { amount } = req.body;
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    const payment = loan.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const remaining = Number((payment.amount - payment.paidAmount).toFixed(2));
    const received = Number(amount);
    if (!received || received <= 0 || received > remaining) return res.status(400).json({ message: `Enter an amount from ₱0.01 to ₱${remaining.toFixed(2)}` });
    payment.paidAmount = Number((payment.paidAmount + received).toFixed(2));
    payment.status = payment.paidAmount >= payment.amount ? 'Paid' : 'Partial';
    if (payment.status === 'Paid') payment.paidAt = new Date();
    if (loan.payments.every(p => p.status === 'Paid')) loan.status = 'Completed';
    await loan.save();
    res.json(await loan.populate('customer'));
  } catch (e) { res.status(400).json({ message: e.message }); }
}

export async function dashboard(req, res) {
  const [customers, loans] = await Promise.all([Customer.countDocuments(), Loan.find()]);
  const activeLoans = loans.filter(l => l.status === 'Active').length;
  const totalPayable = loans.reduce((s, l) => s + l.totalPayable, 0);
  const collected = loans.reduce((s, l) => s + l.payments.reduce((p, x) => p + x.paidAmount, 0), 0);
  res.json({ customers, loans: loans.length, activeLoans, totalPayable, collected, remaining: Number((totalPayable - collected).toFixed(2)) });
}


export async function updateLoan(req, res) {
  try {
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });

    const {
      borrowerName,
      principal,
      interestValue,
      termCount,
      startDate
    } = req.body;

    if (!borrowerName?.trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    const principalValue = Number(principal);
    const interestValueNumber = Number(interestValue);
    const termValue = Number(termCount);

    if (!principalValue || principalValue <= 0 || Number.isNaN(interestValueNumber) || interestValueNumber < 0 || !termValue || termValue < 1) {
      return res.status(400).json({ message: 'Enter valid loan amount, interest, and term.' });
    }

    const customer = await Customer.findById(loan.customer);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    customer.name = borrowerName.trim();
    await customer.save();

    const nextStartDate = startDate || loan.startDate;
    if (!nextStartDate || Number.isNaN(new Date(nextStartDate).getTime())) {
      return res.status(400).json({ message: 'Enter a valid loan start date.' });
    }

    const interestAmount = calculateInterest(principalValue, loan.interestType || 'fixed', interestValueNumber);
    const totalPayable = Number((principalValue + interestAmount).toFixed(2));
    const count = installmentsFor(termValue, loan.termUnit || 'months', loan.frequency || '15days', loan.customDays);

    const hasPayments = loan.payments.some(p => Number(p.paidAmount || 0) > 0);

    if (hasPayments && (
      principalValue !== Number(loan.principal) ||
      interestValueNumber !== Number(loan.interestValue) ||
      termValue !== Number(loan.termCount) ||
      new Date(nextStartDate).getTime() !== new Date(loan.startDate).getTime()
    )) {
      return res.status(400).json({
        message: 'This loan already has recorded payments. Only the customer name can be edited after payments have started.'
      });
    }

    loan.principal = principalValue;
    loan.interestValue = interestValueNumber;
    loan.interestAmount = interestAmount;
    loan.totalPayable = totalPayable;
    loan.termCount = termValue;
    loan.startDate = nextStartDate;

    if (!hasPayments) {
      loan.payments = buildPayments(
        totalPayable,
        count,
        loan.startDate,
        loan.frequency || '15days',
        loan.customDays
      );
      loan.status = 'Active';
    }

    await loan.save();
    res.json(await loan.populate('customer'));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

export async function deleteLoan(req, res) {
  try {
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });

    const customerId = loan.customer;
    const deletedPaymentCount = Array.isArray(loan.payments)
      ? loan.payments.filter(p => Number(p.paidAmount || 0) > 0).length
      : 0;

    // Deletion is intentionally allowed even when the loan is unpaid, partially paid,
    // or already completed. The UI asks for an explicit confirmation before this destructive action.
    await Loan.findByIdAndDelete(req.params.loanId);

    // Loan creation can automatically create a customer. Remove that customer only
    // when this was their last remaining loan, so unrelated customers/loans are preserved.
    if (customerId) {
      const remainingLoans = await Loan.countDocuments({ customer: customerId });
      if (remainingLoans === 0) {
        await Customer.findByIdAndDelete(customerId);
      }
    }

    res.json({
      message: deletedPaymentCount
        ? 'Loan and its payment records were deleted successfully.'
        : 'Loan deleted successfully.'
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}
