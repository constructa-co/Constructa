import { getCostLibraryAction } from "@/app/dashboard/library/actions";
import LibraryManagement from "@/app/dashboard/library/library-management";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
    const items = await getCostLibraryAction();

    return (
        <div className="max-w-6xl mx-auto p-8 pt-24 text-black min-h-screen">
            <header className="mb-8">
                <h1 className="text-4xl font-black italic tracking-tighter text-slate-900 uppercase">Library Registry</h1>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Lean MVP Master Rates</p>
            </header>

            <LibraryManagement items={items || []} />
        </div>
    );
}
