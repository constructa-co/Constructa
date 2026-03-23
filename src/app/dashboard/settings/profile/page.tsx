import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updateProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return (
        <div className="max-w-4xl mx-auto p-8 pt-12 space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-100">Company Profile</h1>
                <p className="text-slate-400 mt-1">
                    This information feeds into every proposal PDF you generate.
                </p>
            </div>

            <form action={updateProfileAction} className="space-y-6">
                {/* Section A — Personal Details */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                    <h2 className="text-lg font-bold text-slate-100">Personal Details</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">Full Name</label>
                            <input
                                name="full_name"
                                defaultValue={profile?.full_name || ""}
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="John Smith"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">Email</label>
                            <input
                                value={user.email || ""}
                                readOnly
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-500 cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">Phone</label>
                            <input
                                name="phone"
                                defaultValue={profile?.phone || ""}
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="07700 900123"
                            />
                        </div>
                    </div>
                </div>

                {/* Section B — Company Profile / Capability Statement */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                    <h2 className="text-lg font-bold text-slate-100">Company Profile</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">Company Name</label>
                            <input
                                name="company_name"
                                defaultValue={profile?.company_name || ""}
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="Apex Construction Ltd"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">Company Registration Number</label>
                            <input
                                name="company_number"
                                defaultValue={profile?.company_number || ""}
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="12345678"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">VAT Number</label>
                            <input
                                name="vat_number"
                                defaultValue={profile?.vat_number || ""}
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="GB 123 4567 89"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">Trading Address</label>
                            <input
                                name="address"
                                defaultValue={profile?.address || ""}
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="123 High Street, London, SW1A 1AA"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">Website</label>
                            <input
                                name="website"
                                defaultValue={profile?.website || ""}
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="https://www.example.co.uk"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-400">Years Trading</label>
                            <input
                                name="years_trading"
                                type="number"
                                min={0}
                                defaultValue={profile?.years_trading || ""}
                                className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="15"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Specialisms</label>
                        <input
                            name="specialisms"
                            defaultValue={profile?.specialisms || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="Brickwork, Extensions, Groundworks"
                        />
                        <p className="text-xs text-slate-500">Comma-separated list of your key trades/specialisms</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Insurance Details</label>
                        <textarea
                            name="insurance_details"
                            defaultValue={profile?.insurance_details || ""}
                            rows={2}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="Public Liability: £5M, Employer's Liability: £10M"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Accreditations</label>
                        <input
                            name="accreditations"
                            defaultValue={profile?.accreditations || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="CITB, FMB Member, NHBC Registered"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Capability Statement</label>
                        <textarea
                            name="capability_statement"
                            defaultValue={profile?.capability_statement || ""}
                            rows={5}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="We are a family-run business with over 20 years of experience in residential and commercial construction across the South East..."
                        />
                        <p className="text-xs text-slate-500">
                            This is your &ldquo;About Us&rdquo; paragraph — it appears on every proposal PDF.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Logo URL (paste a direct image link)</label>
                        <input
                            name="logo_url"
                            defaultValue={profile?.logo_url || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="https://example.com/logo.png"
                        />
                        {profile?.logo_url && (
                            <div className="mt-2 p-2 bg-slate-800 rounded-lg inline-block border border-slate-700">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={profile.logo_url} alt="Logo preview" className="h-16 w-auto object-contain" />
                            </div>
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-all active:scale-[0.98]"
                >
                    Save Company Profile
                </button>
            </form>
        </div>
    );
}
