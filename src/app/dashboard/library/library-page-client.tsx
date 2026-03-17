"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import RateOverrideItem from "./rate-override-client";

interface CategoryWithItems {
    id: string;
    code: string;
    name: string;
    description?: string;
    sort_order: number;
    items: Array<{
        id: string;
        code: string;
        description: string;
        unit: string;
        base_rate: number;
        is_featured: boolean;
        override: { custom_rate: number; notes?: string } | null;
    }>;
}

interface Props {
    categoriesWithItems: CategoryWithItems[];
}

export default function LibraryPageClient({ categoriesWithItems }: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [openCategories, setOpenCategories] = useState<Set<string>>(
        new Set([categoriesWithItems[0]?.id]) // first category open by default
    );
    const [showAllMap, setShowAllMap] = useState<Set<string>>(new Set());

    const toggleCategory = (id: string) => {
        setOpenCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleShowAll = (id: string) => {
        setShowAllMap(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // When searching, flatten and filter all items
    const isSearching = searchQuery.trim().length > 0;
    const searchResults = useMemo(() => {
        if (!isSearching) return [];
        const q = searchQuery.toLowerCase();
        return categoriesWithItems.flatMap(cat =>
            cat.items
                .filter(i => i.description.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
                .map(i => ({ ...i, categoryName: cat.name }))
        );
    }, [searchQuery, categoriesWithItems, isSearching]);

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                    placeholder="Search all 330+ items across all trades..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-500"
                />
            </div>

            {/* Search Results */}
            {isSearching && (
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700">
                        <span className="text-sm text-slate-400">
                            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
                        </span>
                    </div>
                    {searchResults.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-500 text-sm">
                            No items found. You can add custom items to your library.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50 px-2 py-1">
                            {searchResults.map(item => (
                                <div key={item.id}>
                                    <div className="text-[10px] text-slate-600 uppercase px-3 pt-2">{item.categoryName}</div>
                                    <RateOverrideItem item={item} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Category Accordions */}
            {!isSearching && categoriesWithItems.map(cat => {
                const isOpen = openCategories.has(cat.id);
                const showAll = showAllMap.has(cat.id);
                const featuredItems = cat.items.filter(i => i.is_featured);
                const allItems = cat.items;
                const displayItems = showAll ? allItems : featuredItems;
                const hasMore = allItems.length > featuredItems.length;
                const overrideCount = cat.items.filter(i => i.override).length;

                return (
                    <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        {/* Category Header */}
                        <button
                            type="button"
                            onClick={() => toggleCategory(cat.id)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {isOpen
                                    ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                }
                                <div className="text-left">
                                    <div className="font-semibold text-white">{cat.name}</div>
                                    {cat.description && (
                                        <div className="text-xs text-slate-500 mt-0.5">{cat.description}</div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                {overrideCount > 0 && (
                                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                                        {overrideCount} custom rate{overrideCount > 1 ? 's' : ''}
                                    </span>
                                )}
                                <span className="text-xs text-slate-500">{allItems.length} items</span>
                            </div>
                        </button>

                        {/* Category Items */}
                        {isOpen && (
                            <div className="border-t border-slate-800">
                                <div className="px-2 py-1 divide-y divide-slate-800/50">
                                    {displayItems.map(item => (
                                        <RateOverrideItem key={item.id} item={item} />
                                    ))}
                                </div>

                                {/* Show All / Show Less Toggle */}
                                {hasMore && (
                                    <div className="px-5 py-3 border-t border-slate-800/50">
                                        <button
                                            type="button"
                                            onClick={() => toggleShowAll(cat.id)}
                                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            {showAll
                                                ? `Show featured items only`
                                                : `Show all ${allItems.length} items (${allItems.length - featuredItems.length} more)`
                                            }
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
