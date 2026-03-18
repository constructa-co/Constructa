"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, Check, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchLibraryItemsAction, addLineFromLibraryAction } from "./actions";

interface LibraryItem {
    id: string;
    code: string;
    description: string;
    unit: string;
    base_rate: number;
    category_name: string;
    is_featured: boolean;
    effective_rate: number;
    has_override: boolean;
}

interface LibraryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    estimateId: string;
    orgId: string;
    categories: { id: string; name: string; sort_order: number }[];
    onItemAdded: () => void;
}

export default function LibraryDrawer({
    isOpen,
    onClose,
    estimateId,
    orgId,
    categories,
    onItemAdded,
}: LibraryDrawerProps) {
    const [query, setQuery] = useState("");
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedItemId, setAddedItemId] = useState<string | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const fetchItems = useCallback(
        async (searchQuery: string, catId: string | null) => {
            setLoading(true);
            try {
                const results = await searchLibraryItemsAction(searchQuery, catId, orgId);
                setItems(results);
            } catch {
                setItems([]);
            } finally {
                setLoading(false);
            }
        },
        [orgId]
    );

    // Fetch on open
    useEffect(() => {
        if (isOpen) {
            fetchItems(query, activeCategoryId);
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Debounced search
    useEffect(() => {
        if (!isOpen) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchItems(query, activeCategoryId);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, activeCategoryId, isOpen, fetchItems]);

    const handleAddItem = async (itemId: string) => {
        try {
            await addLineFromLibraryAction(estimateId, itemId, orgId);
            setAddedItemId(itemId);
            onItemAdded();
            setTimeout(() => setAddedItemId(null), 1500);
        } catch {
            // Silent fail — item row will just reset
        }
    };

    const handleCategoryClick = (catId: string | null) => {
        setActiveCategoryId(catId);
        setQuery("");
    };

    // Group items by category for featured/default view
    const grouped = items.reduce<Record<string, LibraryItem[]>>((acc, item) => {
        const cat = item.category_name;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    const showGrouped = !query && !activeCategoryId;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                onClick={onClose}
            />

            {/* Desktop drawer (md+) */}
            <div
                className={`fixed top-0 right-0 h-full w-[400px] bg-slate-900 z-50 shadow-2xl transition-transform duration-300 ease-out hidden md:flex flex-col ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <DrawerContent
                    query={query}
                    setQuery={setQuery}
                    activeCategoryId={activeCategoryId}
                    categories={categories}
                    onCategoryClick={handleCategoryClick}
                    loading={loading}
                    items={items}
                    grouped={grouped}
                    showGrouped={showGrouped}
                    addedItemId={addedItemId}
                    onAddItem={handleAddItem}
                    onClose={onClose}
                />
            </div>

            {/* Mobile bottom sheet (<md) */}
            <div
                className={`fixed bottom-0 left-0 right-0 bg-slate-900 z-50 shadow-2xl transition-transform duration-300 ease-out md:hidden flex flex-col rounded-t-2xl max-h-[75vh] ${
                    isOpen ? "translate-y-0" : "translate-y-full"
                }`}
            >
                <DrawerContent
                    query={query}
                    setQuery={setQuery}
                    activeCategoryId={activeCategoryId}
                    categories={categories}
                    onCategoryClick={handleCategoryClick}
                    loading={loading}
                    items={items}
                    grouped={grouped}
                    showGrouped={showGrouped}
                    addedItemId={addedItemId}
                    onAddItem={handleAddItem}
                    onClose={onClose}
                />
            </div>
        </>
    );
}

function DrawerContent({
    query,
    setQuery,
    activeCategoryId,
    categories,
    onCategoryClick,
    loading,
    items,
    grouped,
    showGrouped,
    addedItemId,
    onAddItem,
    onClose,
}: {
    query: string;
    setQuery: (q: string) => void;
    activeCategoryId: string | null;
    categories: { id: string; name: string; sort_order: number }[];
    onCategoryClick: (id: string | null) => void;
    loading: boolean;
    items: LibraryItem[];
    grouped: Record<string, LibraryItem[]>;
    showGrouped: boolean;
    addedItemId: string | null;
    onAddItem: (id: string) => void;
    onClose: () => void;
}) {
    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
                <h2 className="text-slate-100 font-bold text-lg">Add from Library</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                >
                    <X className="w-5 h-5" />
                </Button>
            </div>

            {/* Search */}
            <div className="px-5 pt-4 pb-2 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search 235+ items..."
                        className="pl-10 h-11 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500"
                    />
                </div>
            </div>

            {/* Category pills */}
            <div className="px-5 py-2 shrink-0 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                    <button
                        onClick={() => onCategoryClick(null)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                            !activeCategoryId
                                ? "bg-slate-600 text-slate-100"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                    >
                        All
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => onCategoryClick(cat.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                                activeCategoryId === cat.id
                                    ? "bg-slate-600 text-slate-100"
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="h-16 bg-slate-800 rounded-lg animate-pulse"
                            />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p className="text-sm">
                            {query
                                ? `No items match '${query}'`
                                : "No items found"}
                        </p>
                    </div>
                ) : showGrouped ? (
                    Object.entries(grouped).map(([category, catItems]) => (
                        <div key={category} className="mb-4">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
                                {category}
                            </h3>
                            <div className="space-y-2">
                                {catItems.map((item) => (
                                    <ItemRow
                                        key={item.id}
                                        item={item}
                                        isAdded={addedItemId === item.id}
                                        onAdd={onAddItem}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    items.map((item) => (
                        <ItemRow
                            key={item.id}
                            item={item}
                            isAdded={addedItemId === item.id}
                            onAdd={onAddItem}
                        />
                    ))
                )}
            </div>
        </>
    );
}

function ItemRow({
    item,
    isAdded,
    onAdd,
}: {
    item: LibraryItem;
    isAdded: boolean;
    onAdd: (id: string) => void;
}) {
    const [adding, setAdding] = useState(false);

    const handleClick = async () => {
        setAdding(true);
        await onAdd(item.id);
        setAdding(false);
    };

    return (
        <div className="flex items-center justify-between gap-3 p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-500 font-mono text-xs shrink-0">
                        {item.code}
                    </span>
                    <span className="text-slate-100 font-medium text-sm truncate">
                        {item.description}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{item.unit}</span>
                    <span className="text-slate-600">·</span>
                    {item.has_override ? (
                        <>
                            <span className="text-emerald-400 font-medium">
                                Your rate: £{Number(item.effective_rate).toFixed(2)}
                            </span>
                            <span className="text-slate-500 line-through">
                                £{Number(item.base_rate).toFixed(2)}
                            </span>
                        </>
                    ) : (
                        <span className="text-slate-400">
                            Market: £{Number(item.base_rate).toFixed(2)}
                        </span>
                    )}
                </div>
            </div>

            <button
                onClick={handleClick}
                disabled={adding || isAdded}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-60 shrink-0"
            >
                {isAdded ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                ) : adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Plus className="w-4 h-4" />
                )}
            </button>
        </div>
    );
}
