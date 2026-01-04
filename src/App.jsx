import React, { useState, useEffect } from 'react';
import { auth, db, provider } from './firebase'; 
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, addDoc, query, where, onSnapshot, 
  orderBy, serverTimestamp, doc, deleteDoc, updateDoc, setDoc, getDoc 
} from 'firebase/firestore';
import { LogOut, Wallet, Trash2, Settings, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [isNeed, setIsNeed] = useState(true); 
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false); 
  const [monthlyBudget, setMonthlyBudget] = useState(10000);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        // Fetch User Budget
        const budgetRef = doc(db, 'users', currentUser.uid);
        onSnapshot(budgetRef, (docSnap) => {
          if (docSnap.exists()) setMonthlyBudget(docSnap.data().budget || 10000);
        });

        // Fetch Expenses
        const q = query(collection(db, 'expenses'), where('uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const unsubscribeData = onSnapshot(q, (snapshot) => {
          setExpenses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        });
        return () => unsubscribeData();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => { try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); } };
  const handleLogout = () => signOut(auth);

  const updateBudget = async (val) => {
    const num = parseFloat(val) || 0;
    setMonthlyBudget(num);
    if (user && num >= 0) {
      await setDoc(doc(db, 'users', user.uid), { budget: num }, { merge: true });
    }
  };

  const saveExpense = async (e) => {
    e.preventDefault(); 
    const numAmount = parseFloat(amount);
    if (!amount || numAmount <= 0) {
      alert("Please enter a positive amount");
      return;
    }
    if (!user) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'expenses', editingId), { amount: numAmount, category, isNeed });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'expenses'), { uid: user.uid, amount: numAmount, category, isNeed, createdAt: serverTimestamp() });
      }
      setAmount('');
    } catch (e) { alert(e.message); }
  };

  const deleteExpense = async (id) => { if (window.confirm("Delete?")) await deleteDoc(doc(db, 'expenses', id)); };

  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const percentageUsed = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;
  
  const chartData = [
    { name: 'Needs', value: expenses.filter(e => e.isNeed).reduce((s, i) => s + i.amount, 0) || 0.1 },
    { name: 'Wants', value: expenses.filter(e => !e.isNeed).reduce((s, i) => s + i.amount, 0) || 0.1 },
  ];
  const COLORS = ['#10b981', '#f43f5e'];

  if (loading) return <div className="h-screen w-full flex items-center justify-center font-black text-blue-600 animate-pulse">FINTRACK...</div>;

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-blue-600 p-6">
        <div className="bg-white p-20 rounded-[4rem] text-center shadow-2xl">
          <h1 className="text-6xl font-black mb-10 italic">FinTrack</h1>
          <button onClick={handleLogin} className="bg-black text-white px-10 py-5 rounded-2xl font-bold text-xl cursor-pointer">Continue with Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <header className="p-6 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
        <h1 className="text-2xl font-black flex items-center gap-2 text-blue-600"><Wallet /> FinTrack</h1>
        <button onClick={handleLogout} className="font-bold text-slate-400 hover:text-red-500 flex items-center gap-2 cursor-pointer"><LogOut size={18}/> Logout</button>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className={`flex-1 p-10 rounded-[3rem] text-white shadow-xl transition-colors duration-500 ${percentageUsed > 90 ? 'bg-rose-500' : 'bg-blue-600'}`}>
            <p className="text-xs font-bold tracking-widest opacity-80 mb-2 uppercase">Total Spent</p>
            <h2 className="text-6xl font-black mb-6">₹{totalSpent.toLocaleString()}</h2>
            <div className="w-full bg-white/20 rounded-full h-3 mb-4">
              <div className="bg-white h-full rounded-full" style={{ width: `${Math.min(percentageUsed, 100)}%` }}></div>
            </div>
            <p className="font-bold opacity-90">{percentageUsed.toFixed(1)}% of budget used</p>
          </div>

          <div className="lg:w-1/3 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <label htmlFor="budget-limit" className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-4">Set Monthly Limit</label>
            <div className="flex items-center gap-4">
              <Settings className="text-blue-600" />
              <input 
                id="budget-limit"
                type="number" 
                value={monthlyBudget} 
                onChange={(e) => updateBudget(e.target.value)} 
                className="text-4xl font-black w-full outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={saveExpense} className="bg-white p-10 rounded-[4rem] shadow-xl space-y-8 border border-slate-100">
            <div>
              <label htmlFor="amount-input" className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-4 ml-4">Amount (₹)</label>
              <input 
                id="amount-input"
                name="amount"
                type="number" 
                min="1"
                step="0.01"
                placeholder="0.00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-8 rounded-3xl bg-slate-50 border-none ring-4 ring-slate-100 text-4xl font-black outline-none focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="category-select" className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-4">Category</label>
                <select id="category-select" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-5 rounded-2xl bg-slate-50 font-bold border-none ring-2 ring-slate-100 outline-none">
                  <option>Food</option><option>Travel</option><option>Study</option><option>Fun</option>
                </select>
              </div>
              <button type="submit" className="px-10 bg-slate-900 text-white rounded-2xl font-black hover:bg-blue-600 transition-colors cursor-pointer">ADD</button>
            </div>

            <div className="flex gap-8 px-4">
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={isNeed} onChange={() => setIsNeed(true)} /> Need</label>
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={!isNeed} onChange={() => setIsNeed(false)} /> Want</label>
            </div>
          </form>

          <div className="bg-white p-10 rounded-[4rem] shadow-sm flex flex-col items-center border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Expense Split</h3>
            <div style={{ width: '100%', height: '300px' }}>
              {mounted && (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i]} stroke="none" />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex gap-6 mt-4 text-[10px] font-black">
              <span className="text-emerald-500">● NEEDS</span>
              <span className="text-rose-500">● WANTS</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-20">
          {expenses.map(exp => (
            <div key={exp.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${exp.isNeed ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <div>
                  <p className="font-black text-slate-800">{exp.category}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                    {exp.createdAt?.toDate().toLocaleDateString() || '...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-black text-xl text-slate-900">₹{exp.amount}</p>
                <button onClick={() => deleteExpense(exp.id)} className="text-slate-200 hover:text-rose-500 transition-colors cursor-pointer"><Trash2 size={18}/></button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;