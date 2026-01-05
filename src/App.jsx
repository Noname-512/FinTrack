import React, { useState, useEffect } from 'react';
import { auth, db, provider } from './firebase'; 
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, addDoc, query, where, onSnapshot, 
  orderBy, serverTimestamp, doc, deleteDoc, updateDoc, setDoc 
} from 'firebase/firestore';
// Added TrendingUp and TrendingDown back to imports
import { LogOut, Wallet, Trash2, Settings, Edit2, TrendingUp, TrendingDown, Plus, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [categories, setCategories] = useState(['Food', 'Travel', 'Study', 'Fun']);
  const [newCategory, setNewCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
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
        const budgetRef = doc(db, 'users', currentUser.uid);
        onSnapshot(budgetRef, (docSnap) => {
          if (docSnap.exists()) setMonthlyBudget(docSnap.data().budget || 10000);
        });
        const q = query(collection(db, 'expenses'), where('uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const unsubscribeData = onSnapshot(q, (snapshot) => {
          setExpenses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        });
        return () => unsubscribeData();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => signOut(auth);
  const handleLogin = async () => { try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); } };

  const updateBudget = async (val) => {
    setMonthlyBudget(val);
    const num = parseFloat(val);
    if (user && !isNaN(num) && num > 0) {
      await setDoc(doc(db, 'users', user.uid), { budget: num }, { merge: true });
    }
  };

  const addCustomCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      setCategories([...categories, newCategory]);
      setCategory(newCategory);
      setNewCategory('');
      setShowAddCategory(false);
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
  const remainingBalance = (parseFloat(monthlyBudget) || 0) - totalSpent;
  const percentageUsed = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;
  
  const chartData = [
    { name: 'Needs', value: expenses.filter(e => e.isNeed).reduce((s, i) => s + i.amount, 0) || 0.1 },
    { name: 'Wants', value: expenses.filter(e => !e.isNeed).reduce((s, i) => s + i.amount, 0) || 0.1 },
  ];
  const COLORS = ['#10b981', '#f43f5e'];

  if (loading) return <div className="h-screen w-full flex items-center justify-center font-black text-blue-600 text-3xl animate-pulse">FINTRACK...</div>;

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
    <div className="min-h-screen w-full flex flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-50 w-full px-6 sm:px-12 py-5 backdrop-blur-lg bg-white/70 border-b border-gray-100 flex justify-between items-center shadow-sm">
        <h1 className="text-3xl font-black text-blue-600 flex items-center gap-3 tracking-tighter">
          <Wallet size={32} /> FinTrack
        </h1>
        <div className="flex items-center gap-4">
          <img src={user?.photoURL} alt="User" className="w-10 h-10 rounded-full border-2 border-blue-600 shadow-sm" />
          <button onClick={handleLogout} className="flex items-center gap-2 font-bold text-gray-500 hover:text-red-500 transition-all cursor-pointer">
            <LogOut size={20} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full px-6 sm:px-12 py-10 space-y-10">
        <div className="flex flex-col xl:flex-row gap-8">
          {/* CARD WITH DYNAMIC ARROW FEATURE */}
          <div className={`relative overflow-hidden flex-1 p-12 rounded-[4rem] text-white shadow-2xl transition-all duration-700 ${percentageUsed > 80 ? 'bg-rose-500' : 'bg-blue-600'}`}>
            <p className="text-xs font-bold uppercase tracking-[0.4em] opacity-70 mb-4">Expenditure vs Remaining</p>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
              <h2 className="text-7xl sm:text-8xl font-black tracking-tighter">₹{totalSpent.toLocaleString()}</h2>
              
              {/* ARROW FEATURE: Icon changes based on spending status */}
              <div className="flex flex-col items-center gap-2">
                 {percentageUsed > 80 ? <TrendingUp size={48} className="animate-bounce" /> : <TrendingDown size={48} />}
                 <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20 min-w-[200px]">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Remaining Balance</p>
                    <p className="text-3xl font-black">₹{remainingBalance.toLocaleString()}</p>
                 </div>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-5 p-1">
              <div className="bg-white h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentageUsed, 100)}%` }}></div>
            </div>
          </div>

          <div className="w-full xl:w-[400px] bg-white p-10 rounded-[4rem] border border-gray-100 shadow-xl flex flex-col justify-center">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Budget Target</h3>
            <div className="flex items-center gap-4">
              <Settings className="text-blue-600" size={32} />
              <input type="number" min="1" value={monthlyBudget} onChange={(e) => updateBudget(e.target.value)} onWheel={(e) => e.target.blur()} className="bg-transparent font-black text-5xl w-full outline-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={saveExpense} className="bg-white border border-gray-100 p-10 sm:p-14 rounded-[4.5rem] shadow-2xl space-y-8">
            <div className="flex flex-col gap-3">
               <label htmlFor="amount-input" className="text-xs font-black text-blue-600 ml-6 uppercase tracking-widest">Amount (₹)</label>
               <input id="amount-input" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} onWheel={(e) => e.target.blur()} className="w-full p-10 rounded-[3rem] bg-gray-50 text-6xl font-black outline-none" />
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-6">
                <label className="text-[10px] font-black text-gray-400 uppercase">Category</label>
                <button type="button" onClick={() => setShowAddCategory(!showAddCategory)} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                  {showAddCategory ? <><X size={12}/> Cancel</> : <><Plus size={12}/> Custom</>}
                </button>
              </div>

              {showAddCategory ? (
                <div className="flex gap-2">
                  <input type="text" placeholder="New Category..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 p-6 rounded-3xl bg-gray-50 font-black outline-none border-2 border-blue-100" />
                  <button type="button" onClick={addCustomCategory} className="bg-blue-600 text-white px-8 rounded-3xl font-black">ADD</button>
                </div>
              ) : (
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-8 rounded-[2.5rem] bg-gray-50 font-black text-2xl appearance-none outline-none ring-4 ring-transparent focus:ring-blue-50">
                  {categories.map(cat => <option key={cat}>{cat}</option>)}
                </select>
              )}
            </div>

            <div className="flex gap-12 px-6">
              <label className="flex items-center gap-3 text-xl font-bold cursor-pointer">
                <input type="checkbox" checked={isNeed} onChange={() => setIsNeed(true)} className="w-6 h-6 accent-emerald-500" /> Need
              </label>
              <label className="flex items-center gap-3 text-xl font-bold cursor-pointer">
                <input type="checkbox" checked={!isNeed} onChange={() => setIsNeed(false)} className="w-6 h-6 accent-rose-500" /> Want
              </label>
              <button type="submit" className="ml-auto px-16 py-6 bg-gray-900 text-white rounded-[2rem] font-black text-xl hover:bg-blue-600 transition-all">SAVE</button>
            </div>
          </form>

          <div className="bg-white p-12 rounded-[4.5rem] border border-gray-100 flex flex-col items-center shadow-xl">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Split</h3>
            <div style={{ width: '100%', height: '350px' }}>
              {mounted && (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={10} dataKey="value">
                      {chartData.map((e, i) => <Cell key={i} fill={COLORS[i]} cornerRadius={20} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '20px', fontWeight: '900' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
