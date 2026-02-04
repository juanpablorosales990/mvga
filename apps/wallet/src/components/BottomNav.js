import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
const navItems = [
    {
        path: '/',
        label: 'Wallet',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" }) })),
    },
    {
        path: '/send',
        label: 'Send',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 11l5-5m0 0l5 5m-5-5v12" }) })),
    },
    {
        path: '/receive',
        label: 'Receive',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 13l-5 5m0 0l-5-5m5 5V6" }) })),
    },
    {
        path: '/swap',
        label: 'Swap',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" }) })),
    },
    {
        path: '/p2p',
        label: 'P2P',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" }) })),
    },
];
export default function BottomNav() {
    return (_jsx("nav", { className: "fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-white/10 safe-bottom", children: _jsx("div", { className: "max-w-lg mx-auto flex justify-around py-2", children: navItems.map((item) => (_jsxs(NavLink, { to: item.path, className: ({ isActive }) => clsx('flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors', isActive ? 'text-primary-500' : 'text-gray-500 hover:text-gray-300'), children: [item.icon, _jsx("span", { className: "text-xs", children: item.label })] }, item.path))) }) }));
}
//# sourceMappingURL=BottomNav.js.map