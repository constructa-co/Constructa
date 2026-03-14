'use client';

import { useState } from "react";
import { addResourceAction, deleteResourceAction } from "./actions";

// --- Inline UI Components ---
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`rounded-xl border bg-card text-card-foreground shadow-sm bg-white overflow-hidden ${className}`}>{children}</div>;
}
function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
}
function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return <h3 className={`font-semibold leading-none tracking-tight text-lg ${className}`}>{children}</h3>;
}
function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
    return <p className={`text-sm text-muted-foreground text-gray-500 mt-1 ${className}`}>{children}</p>;
}
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
    return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 ${className}`}>{children}</label>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 text-slate-900"
        />
    );
}
function Button({ children, type = "button", disabled, className, variant, onClick }: { children: React.ReactNode; type?: "button" | "submit"; disabled?: boolean; className?: string; variant?: 'default' | 'outline' | 'ghost'; onClick?: () => void }) {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
    const styles = variant === 'ghost' ? "hover:bg-accent hover:text-red-600 hover:bg-red-50 text-slate-500" : "bg-primary text-primary-foreground hover:bg-primary/90 bg-slate-900 text-white";
    return <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles} ${className}`}>{children}</button>;
}

export default function ClientResources({ labour, plant }: { labour: any[]; plant: any[] }) {
    const [activeTab, setActiveTab] = useState<'labour' | 'plant'>('labour');

    return (
        <div className="space-y-8">
            {/* TABS LIST */}
            <div className="grid w-full grid-cols-2 p-1 bg-slate-100 rounded-lg">
                <button
                    onClick={() => setActiveTab('labour')}
                    className={`text-sm font-medium py-2.5 rounded-md transition-all ${activeTab === 'labour' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Labour & Workforce
                </button>
                <button
                    onClick={() => setActiveTab('plant')}
                    className={`text-sm font-medium py-2.5 rounded-md transition-all ${activeTab === 'plant' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Plant & Machinery
                </button>
            </div>

            {/* LABOUR CONTENT */}
            {activeTab === 'labour' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                    <Card className="border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle>Add New Employee / Contractor</CardTitle>
                            <CardDescription>Define your team rates here. These will appear in the Estimator.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form action={async (fd) => { await addResourceAction(fd); }} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                <input type="hidden" name="type" value="Labour" />
                                <div className="md:col-span-2 space-y-2"><Label>Name / Role</Label><Input name="description" placeholder="e.g. Steve (Electrician)" required /></div>
                                <div className="space-y-2"><Label>Hourly Rate (£)</Label><Input name="rate" type="number" step="0.01" placeholder="25.00" required /></div>
                                <div className="space-y-2"><Label>Overtime Rate (£)</Label><Input name="overtime" type="number" step="0.01" placeholder="37.50" /></div>
                                <input type="hidden" name="unit" value="hour" />
                                <Button type="submit" className="w-full">Add Resource</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4">
                        {labour.map((item) => (
                            <Card key={item.id} className="flex flex-row items-center justify-between p-4 hover:border-blue-200 transition-colors">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-lg text-slate-800">{item.description}</span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 w-fit mt-1 border border-slate-200">{item.code}</span>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="font-bold text-slate-900">£{item.base_rate.toFixed(2)} / hr</div>
                                        <div className="text-xs text-slate-500">OT: £{item.overtime_rate?.toFixed(2)}</div>
                                    </div>
                                    <form action={deleteResourceAction}>
                                        <input type="hidden" name="id" value={item.id} />
                                        <Button type="submit" variant="ghost" className="text-red-500 hover:text-red-700">Remove</Button>
                                    </form>
                                </div>
                            </Card>
                        ))}
                        {labour.length === 0 && <div className="text-center text-slate-400 py-12 border-2 border-dashed rounded-xl bg-slate-50/50">No labour resources defined yet.</div>}
                    </div>
                </div>
            )}

            {/* PLANT CONTENT */}
            {activeTab === 'plant' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                    <Card className="border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle>Add Machinery</CardTitle>
                            <CardDescription>Add owned or hired plant to your fleet.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form action={async (fd) => { await addResourceAction(fd); }} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                <input type="hidden" name="type" value="Plant" />
                                <div className="md:col-span-2 space-y-2"><Label>Item Name</Label><Input name="description" placeholder="e.g. 3T Excavator" required /></div>
                                <div className="space-y-2"><Label>Daily Rate (£)</Label><Input name="rate" type="number" step="0.01" placeholder="120.00" required /></div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <select name="ownership" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-primary">
                                        <option value="Hired">Hired</option>
                                        <option value="Owned">Owned</option>
                                    </select>
                                </div>
                                <input type="hidden" name="unit" value="day" />
                                <Button type="submit" className="w-full">Add Plant</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4">
                        {plant.map((item) => (
                            <Card key={item.id} className="flex flex-row items-center justify-between p-4 hover:border-blue-200 transition-colors">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-lg text-slate-800">{item.description}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 w-fit mt-1 border border-emerald-100 font-medium">{item.ownership_status}</span>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="font-bold text-slate-900">£{item.base_rate.toFixed(2)} / day</div>
                                    </div>
                                    <form action={deleteResourceAction}>
                                        <input type="hidden" name="id" value={item.id} />
                                        <Button type="submit" variant="ghost" className="text-red-500 hover:text-red-700">Remove</Button>
                                    </form>
                                </div>
                            </Card>
                        ))}
                        {plant.length === 0 && <div className="text-center text-slate-400 py-12 border-2 border-dashed rounded-xl bg-slate-50/50">No plant defined yet.</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
