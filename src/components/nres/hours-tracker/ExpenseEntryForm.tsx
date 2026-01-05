import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Plus } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/types/nresHoursTypes';
import { format } from 'date-fns';

interface ExpenseEntryFormProps {
  saving: boolean;
  onSubmit: (expense: {
    expense_date: string;
    category: string;
    description: string | null;
    amount: number;
    receipt_reference: string | null;
  }) => Promise<any>;
}

export function ExpenseEntryForm({ saving, onSubmit }: ExpenseEntryFormProps) {
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptReference, setReceiptReference] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !amount) return;

    const result = await onSubmit({
      expense_date: expenseDate,
      category,
      description: description || null,
      amount: parseFloat(amount),
      receipt_reference: receiptReference || null
    });

    if (result) {
      setCategory('');
      setDescription('');
      setAmount('');
      setReceiptReference('');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Receipt className="w-4 h-4" />
          Log Expense
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="expense-date" className="text-xs">Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="expense-category" className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-amount" className="text-xs">Amount</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                <Input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="receipt-ref" className="text-xs">Receipt/Invoice Ref (optional)</Label>
              <Input
                id="receipt-ref"
                placeholder="e.g., INV-001"
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="expense-description" className="text-xs">Description (optional)</Label>
            <Input
              id="expense-description"
              placeholder="Brief description of the expense..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          <Button 
            type="submit" 
            disabled={saving || !category || !amount}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
