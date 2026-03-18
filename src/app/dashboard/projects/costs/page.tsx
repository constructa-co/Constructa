import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProjectNavBar from "@/components/project-navbar";

export const dynamic = "force-dynamic";

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
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
    return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 text-slate-900 ${props.className}`}
        />
    );
}
function Button({ children, type = "button", disabled, className, variant, onClick, size }: { children: React.ReactNode; type?: "button" | "submit"; disabled?: boolean; className?: string; variant?: 'default' | 'outline' | 'ghost'; onClick?: () => void, size?: 'sm' | 'default' }) {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    const sizes = size === 'sm' ? "h-6 px-2" : "h-10 px-4 py-2";
    const variants = {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 bg-slate-900 text-white",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-slate-100 dark:hover:bg-slate-800"
    };
    const variantStyle = variants[variant || 'default'];

    return <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${sizes} ${variantStyle} ${className}`}>{children}</button>;
}

// --- ACTIONS ---
async function switchProjectAction(formData: FormData) {
    "use server";
    const id = formData.get("projectId") as string;
    redirect(`/dashboard/projects/costs?projectId=${id}`);
}

async function addExpenseAction(formData: FormData) {
    "use server";
    const supabase = createClient();

    const projectId = formData.get("projectId") as string;
    const assemblyId = formData.get("assemblyId") as string;
    const receiptFile = formData.get("receipt") as File;

    // 1. Handle File
    let receiptUrl = null;
    if (receiptFile && receiptFile.size > 0) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${projectId}/${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage.from('receipts').upload(fileName, receiptFile);
        if (!error && data) {
            const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
            receiptUrl = publicUrl;
        }
    }

    // 2. Parse Costs
    const qty = parseFloat(formData.get("quantity") as string) || 1;
    const rate = parseFloat(formData.get("rate") as string) || 0;
    const delivery = parseFloat(formData.get("delivery") as string) || 0;
    const surcharge = parseFloat(formData.get("surcharge") as string) || 0;
    const total = (qty * rate) + delivery + surcharge;

    const targetAssembly = assemblyId === "General" ? null : assemblyId;

    const { error } = await supabase.from("project_expenses").insert({
        project_id: projectId,
        assembly_id: targetAssembly,
        description: formData.get("description") as string,
        supplier: formData.get("supplier") as string,
        quantity: qty,
        unit_rate: rate,
        unit: formData.get("unit") as string,
        delivery_cost: delivery,
        surcharge_cost: surcharge,
        amount: total,
        expense_date: formData.get("date") as string,
        receipt_url: receiptUrl
    });

    if (error) console.error("Expense Error:", error);

    revalidatePath("/dashboard/projects/costs");
}

async function deleteExpenseAction(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("project_expenses").delete().eq("id", formData.get("id"));
    revalidatePath("/dashboard/projects/costs");
}

// --- UI COMPONENT ---
export default async function CostControlPage({ searchParams }: { searchParams: { projectId?: string } }) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) return <div>Please log in</div>;

    // 1. Fetch All Projects (For the Switcher)
    const { data: allProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    // 2. Determine Active Project
    const activeProjectId = searchParams.projectId || allProjects?.[0]?.id;

    // 3. Fetch Active Project Details
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", activeProjectId)
        .single();

    if (!project) return <div className="p-8">No projects found. Create one in the dashboard first.</div>;

    // 4. Fetch Budget & Actuals
    const { data: estimates } = await supabase.from("estimates").select("*").eq("project_id", project.id);
    const { data: expenses } = await supabase.from("project_expenses").select("*, assemblies(name)").eq("project_id", project.id).order("expense_date", { ascending: false });
    // Fetch lines for budget calc
    const { data: lines } = await supabase.from("estimate_lines").select("estimate_id, line_total").in("estimate_id", estimates?.map(e => e.id) || []);

    // Ledger Logic
    const ledger: Record<string, any> = {};

    // Fill Budget
    estimates?.forEach(est => {
        // @ts-ignore
        const estLines = lines?.filter(l => l.estimate_id === est.id) || [];
        // @ts-ignore
        const budget = estLines.reduce((sum, l) => sum + l.line_total, 0);
        const key = est.assembly_id || est.id;
        if (!ledger[key]) ledger[key] = { name: est.version_name, budget: 0, actual: 0 };
        ledger[key].budget += budget;
    });

    // Fill Actuals
    expenses?.forEach(exp => {
        const key = exp.assembly_id || "General";
        if (!ledger[key]) ledger[key] = { name: "General / Overheads", budget: 0, actual: 0 };
        ledger[key].actual += exp.amount;
    });

    const rows = Object.values(ledger);
    const totalBudget = rows.reduce((sum, r) => sum + r.budget, 0);
    const totalSpent = rows.reduce((sum, r) => sum + r.actual, 0);
    const variance = totalBudget - totalSpent;

    return (
        <div className="max-w-7xl mx-auto p-8 pt-24 space-y-8">
            {/* HEADER WITH SWITCHER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Cost Control</h1>
                    <p className="text-slate-500">Managing financials for: <span className="text-black font-semibold">{project.name}</span></p>
                </div>

                <form action={switchProjectAction} className="flex items-center gap-2">
                    <Label className="whitespace-nowrap text-slate-600">Switch Project:</Label>
                    <select
                        name="projectId"
                        className="h-10 border rounded px-3 bg-white min-w-[200px] text-slate-900 border-slate-200"
                        defaultValue={activeProjectId}
                    >
                        {allProjects?.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <Button type="submit" variant="outline" size="sm">Go</Button>
                </form>
                <Link href={`/dashboard/projects/proposal?projectId=${activeProjectId}`}>
                    <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                        📝 Write Proposal
                    </Button>
                </Link>
            </div>

            {/* SUMMARY BANNER */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-6 text-center">
                        <div className="text-xs font-bold text-slate-500 uppercase">Total Budget</div>
                        <div className="text-2xl font-bold text-slate-900">£{totalBudget.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-6 text-center">
                        <div className="text-xs font-bold text-slate-500 uppercase">Actual Spent</div>
                        <div className="text-2xl font-bold text-blue-900">£{totalSpent.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className={`${variance < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                    <CardContent className="p-6 text-center">
                        <div className="text-xs font-bold text-slate-500 uppercase">Net Variance</div>
                        <div className={`text-2xl font-bold ${variance < 0 ? 'text-red-700' : 'text-green-700'}`}>
                            {variance < 0 ? '-' : '+'}£{Math.abs(variance).toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* LOGGER FORM */}
                <Card className="bg-white border-blue-200 shadow-sm">
                    <CardHeader><CardTitle>Log New Invoice</CardTitle></CardHeader>
                    <CardContent>
                        <form action={addExpenseAction} className="space-y-4">
                            <input type="hidden" name="projectId" value={project.id} />

                            <div className="space-y-1">
                                <Label className="text-xs font-bold uppercase text-slate-500">Allocation</Label>
                                <select name="assemblyId" className="w-full h-10 border rounded px-2 bg-white text-sm text-slate-900 border-slate-200">
                                    <option value="General">-- General / Overheads --</option>
                                    {estimates?.map(est => (
                                        <option key={est.assembly_id || est.id} value={est.assembly_id || "General"}>{est.version_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Supplier</Label>
                                    <Input name="supplier" placeholder="e.g. Cemex" required className="bg-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Description / Material</Label>
                                    <Input name="description" placeholder="e.g. Concrete" required className="bg-white" />
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold uppercase text-slate-500">Qty</Label>
                                        <Input name="quantity" type="number" step="0.01" defaultValue="1" className="bg-white" />
                                    </div>

                                    {/* STANDARD UNIT DROPDOWN */}
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold uppercase text-slate-500">Unit</Label>
                                        <select name="unit" className="w-full h-10 border rounded px-2 bg-white text-sm text-slate-900 border-slate-200">
                                            <option value="item">Item</option>
                                            <option value="nr">Nr (Number)</option>
                                            <option value="m">m (Linear)</option>
                                            <option value="m2">m² (Area)</option>
                                            <option value="m3">m³ (Volume)</option>
                                            <option value="kg">kg</option>
                                            <option value="tonne">Tonne</option>
                                            <option value="day">Day</option>
                                            <option value="hour">Hour</option>
                                            <option value="load">Load</option>
                                            <option value="roll">Roll</option>
                                            <option value="bag">Bag</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold uppercase text-slate-500">Rate (£)</Label>
                                        <Input name="rate" type="number" step="0.01" placeholder="0.00" className="bg-white" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold uppercase text-slate-500">Delivery (£)</Label>
                                        <Input name="delivery" type="number" step="0.01" placeholder="0.00" className="bg-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold uppercase text-slate-500">Surcharge (£)</Label>
                                        <Input name="surcharge" type="number" step="0.01" placeholder="0.00" className="bg-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 border-t pt-4">
                                <Label className="text-blue-700 font-bold">Receipt / Evidence</Label>
                                <Input className="bg-blue-50 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" type="file" name="receipt" accept="image/*,application/pdf" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold uppercase text-slate-500">Invoice Date</Label>
                                <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="bg-white" />
                            </div>
                            <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white">Log Expense</Button>
                        </form>
                    </CardContent>
                </Card>

                {/* VARIANCE TABLE */}
                <Card>
                    <CardHeader><CardTitle>Budget Reconciliation</CardTitle></CardHeader>
                    <CardContent>
                        <table className="w-full text-sm">
                            <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-2 text-slate-600">Task</th><th className="pb-2 text-right text-slate-600">Budget</th><th className="pb-2 text-right text-slate-600">Actual</th><th className="pb-2 text-right text-slate-600">Var</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map((r, i) => {
                                    const v = r.budget - r.actual;
                                    return (
                                        <tr key={i}>
                                            <td className="py-3 font-medium text-slate-900">{r.name}</td>
                                            <td className="py-3 text-right text-slate-500">£{r.budget.toFixed(0)}</td>
                                            <td className="py-3 text-right font-bold text-slate-900">£{r.actual.toFixed(0)}</td>
                                            <td className={`py-3 text-right font-bold ${v < 0 ? 'text-red-600' : 'text-green-600'}`}>{v < 0 ? '-' : '+'}£{Math.abs(v).toFixed(0)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            <div className="mb-6">
                <ProjectNavBar projectId={activeProjectId} activeTab="costing" />
            </div>

            {/* HISTORY */}
            <Card>
                <CardHeader><CardTitle>Expense History</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {expenses?.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center p-3 border border-slate-200 rounded bg-white">
                                <div>
                                    <div className="font-bold text-slate-900">{exp.supplier} - {exp.description}</div>
                                    <div className="text-xs text-slate-500">{exp.quantity} {exp.unit} @ £{exp.unit_rate}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link href={`/dashboard/foundations?projectId=${project.id}`}>
                                        <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                                            🏗️ Foundations
                                        </Button>
                                    </Link>
                                    <span className="font-bold text-slate-700">£{exp.amount.toFixed(2)}</span>
                                    {exp.receipt_url && <a href={exp.receipt_url} target="_blank" className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200">View</a>}
                                    <form action={deleteExpenseAction}><input type="hidden" name="id" value={exp.id} /><Button type="submit" variant="ghost" size="sm" className="text-red-400">×</Button></form>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
