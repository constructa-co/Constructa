import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// --- Inline UI Components ---
function Card({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-xl border bg-card text-card-foreground shadow-sm bg-white ${className}`}>{children}</div>; }
function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) { return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>; }
function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) { return <h3 className={`font-semibold leading-none tracking-tight text-lg text-slate-900 ${className}`}>{children}</h3>; }
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={`p-6 pt-0 ${className}`}>{children}</div>; }
function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) { return <p className={`text-sm text-muted-foreground text-slate-500 ${className}`}>{children}</p>; }
function Label({ children, className }: { children: React.ReactNode; className?: string }) { return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 ${className}`}>{children}</label>; }
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 bg-white text-slate-900 ${props.className}`} />; }
function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 bg-white text-slate-900 ${props.className}`} />; }
function Button({ children, className }: { children: React.ReactNode; className?: string }) { return <button className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 ${className}`}>{children}</button>; }


async function updateProfileAction(formData: FormData) {
    "use server";
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const logoFile = formData.get("logo") as File;
    let logoUrl = formData.get("existingLogo") as string;

    // 1. Handle Logo Upload
    if (logoFile && logoFile.size > 0) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('logos').upload(fileName, logoFile);
        if (!error) {
            const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
            logoUrl = data.publicUrl;
        }
    }

    // 2. Upsert Profile
    const profileData = {
        user_id: user.id,
        company_name: formData.get("company_name"),
        address_line1: formData.get("address_line1"),
        city: formData.get("city"),
        postcode: formData.get("postcode"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        website: formData.get("website"),
        bio_text: formData.get("bio"),
        usp_text: formData.get("usp"),
        logo_url: logoUrl
    };

    await supabase.from("profiles").upsert(profileData);
    revalidatePath("/dashboard/settings/profile");
}

export default async function ProfilePage() {
    const supabase = createClient();
    const { data: authData2 } = await supabase.auth.getUser();
    const user = authData2?.user;
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user?.id).single();

    return (
        <div className="max-w-4xl mx-auto p-8 pt-24 space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Company Identity</h1>
                <p className="text-slate-500">This information will appear on your Proposals and Invoices.</p>
            </div>

            <form action={updateProfileAction}>
                <input type="hidden" name="existingLogo" value={profile?.logo_url || ''} />

                <div className="grid gap-6">
                    {/* BRANDING */}
                    <Card>
                        <CardHeader><CardTitle>Brand & Logo</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-6">
                                {profile?.logo_url && (
                                    <img src={profile.logo_url} alt="Logo" className="w-20 h-20 object-contain border rounded-lg p-1" />
                                )}
                                <div className="space-y-1 flex-1">
                                    <Label>Upload Logo</Label>
                                    <Input name="logo" type="file" accept="image/*" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label>Company Name</Label>
                                <Input name="company_name" defaultValue={profile?.company_name || ''} placeholder="e.g. Apex Construction Ltd" required />
                            </div>
                        </CardContent>
                    </Card>

                    {/* CONTACT */}
                    <Card>
                        <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label>Address Line 1</Label><Input name="address_line1" defaultValue={profile?.address_line1 || ''} /></div>
                            <div className="space-y-1"><Label>City</Label><Input name="city" defaultValue={profile?.city || ''} /></div>
                            <div className="space-y-1"><Label>Postcode</Label><Input name="postcode" defaultValue={profile?.postcode || ''} /></div>
                            <div className="space-y-1"><Label>Phone</Label><Input name="phone" defaultValue={profile?.phone || ''} /></div>
                            <div className="space-y-1"><Label>Email</Label><Input name="email" defaultValue={profile?.email || ''} /></div>
                            <div className="space-y-1"><Label>Website</Label><Input name="website" defaultValue={profile?.website || ''} /></div>
                        </CardContent>
                    </Card>

                    {/* THE SALES PITCH */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Capability Statement</CardTitle>
                            <CardDescription>This text will appear in the "About Us" section of your proposals.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label>Company Bio (The Intro)</Label>
                                <Textarea name="bio" defaultValue={profile?.bio_text || ''} placeholder="We are a family-run business with 20 years experience..." rows={4} />
                            </div>
                            <div className="space-y-1">
                                <Label>Why Choose Us? (The USP)</Label>
                                <Textarea name="usp" defaultValue={profile?.usp_text || ''} placeholder="- Fully Insured&#10;- Master Builders Member&#10;- 5 Star Reviews" rows={4} />
                            </div>
                        </CardContent>
                    </Card>

                    <Button className="w-full bg-blue-700 hover:bg-blue-800">Save Company Profile</Button>
                </div>
            </form>
        </div>
    );
}
