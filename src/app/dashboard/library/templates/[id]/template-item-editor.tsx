"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { addItemsToTemplateAction } from "../../templates-actions";

interface Props {
    templateId: string;
    libraryItems: any[];
}

export default function TemplateItemEditor({ templateId, libraryItems }: Props) {
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [quantity, setQuantity] = useState<number>(1);
    const [isPending, setIsPending] = useState(false);

    const handleAdd = async () => {
        if (!selectedItemId) return;

        setIsPending(true);
        const item = libraryItems.find(i => i.id === selectedItemId);
        if (item) {
            try {
                await addItemsToTemplateAction(templateId, [{
                    category: item.category,
                    description: item.description,
                    unit: item.unit,
                    unit_cost: item.unit_cost,
                    quantity: quantity
                }]);
                setSelectedItemId("");
                setQuantity(1);
            } catch (error) {
                console.error("Add error:", error);
            }
        }
        setIsPending(false);
    };

    return (
        <Card className="border-slate-200 shadow-xl bg-slate-50/30 sticky top-8">
            <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Pick from Library</CardTitle>
                <CardDescription>Select an item from your master registry to add to this kit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Library Item</Label>
                    <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Search library..." />
                        </SelectTrigger>
                        <SelectContent>
                            <div className="flex items-center px-3 pb-2 border-b mb-1">
                                <Search className="w-3 h-3 mr-2 text-slate-400" />
                                <input placeholder="Filter..." className="text-xs bg-transparent outline-none w-full" />
                            </div>
                            {libraryItems.map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{item.description}</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{item.category} • £{item.unit_cost}/{item.unit}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Standard Quantity</Label>
                    <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                        className="bg-white"
                        placeholder="e.g. 1"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 italic">This acts as a base multiplier when the kit is applied.</p>
                </div>

                <Button
                    onClick={handleAdd}
                    disabled={!selectedItemId || isPending}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                >
                    {isPending ? "Adding..." : <><Plus className="w-4 h-4 mr-2" /> Add to Kit</>}
                </Button>
            </CardContent>
        </Card>
    );
}
