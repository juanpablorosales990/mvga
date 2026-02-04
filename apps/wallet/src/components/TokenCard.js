import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function TokenCard({ token }) {
    return (_jsxs("div", { className: "card flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden", children: token.logoUrl ? (_jsx("img", { src: token.logoUrl, alt: token.symbol, className: "w-full h-full object-cover" })) : (_jsx("span", { className: "text-sm font-bold", children: token.symbol.slice(0, 2) })) }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: token.symbol }), _jsx("p", { className: "text-sm text-gray-500", children: token.name })] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "font-semibold", children: token.balance.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                        }) }), _jsxs("p", { className: "text-sm text-gray-500", children: ["$", token.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] })] }));
}
//# sourceMappingURL=TokenCard.js.map