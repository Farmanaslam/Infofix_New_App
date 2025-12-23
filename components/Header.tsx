import React from 'react';
import { Menu, Bell, Search } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
  currentUser: User;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, title, currentUser }) => {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
      <div className="flex items-center gap-3 lg:gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 text-slate-600 rounded-xl lg:hidden hover:bg-slate-100 active:scale-95 transition-transform"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg lg:text-xl font-bold text-slate-800 capitalize tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3 lg:gap-6">
        {/* Search Bar - Hidden on small mobile */}
        <div className="hidden md:flex items-center relative">
           <Search size={16} className="absolute left-3 text-slate-400" />
           <input 
             type="text" 
             placeholder="Quick jump..." 
             className="pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white border focus:border-indigo-200 rounded-full text-sm outline-none transition-all w-48 focus:w-64"
           />
        </div>

        <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

        <div className="flex items-center gap-3">
          <button className="relative p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          
          <div className="flex items-center gap-3 pl-2">
            <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-slate-700 leading-none">{currentUser.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{currentUser.role}</p>
            </div>
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-indigo-600 font-bold text-sm">
               {currentUser.photo ? (
                 <img src={currentUser.photo} alt={currentUser.name} className="w-full h-full object-cover" />
               ) : (
                 currentUser.name.charAt(0)
               )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;