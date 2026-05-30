import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Building2, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { backendApi } from "@/lib/backend-api";
import { CompanySearchResult } from "@/types/api";

const Companies = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setSearchQuery(q);
  }, [searchParams]);

  const { data: results = [], isLoading } = useQuery<CompanySearchResult[]>({
    queryKey: ["companiesSearch", searchQuery],
    queryFn: () => backendApi.search.searchCompanies(searchQuery, 20),
    enabled: searchQuery.trim().length > 0,
  });

  const handleSearch = () => {
    if (searchQuery.trim().length === 0) {
      setSearchParams({});
      return;
    }
    setSearchParams({ q: searchQuery });
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">
            Discover companies, connect with organizations, and track your professional interests.
          </p>

          {/* Search Bar */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Search companies..."
              className="flex-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </div>

        {searchQuery.trim().length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Company Results</h2>
            {isLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : results.length === 0 ? (
              <div className="text-muted-foreground">No companies found.</div>
            ) : (
              <div className="space-y-2">
                {results.map((company) => (
                  <div key={company.name} className="flex items-center gap-3 p-2 rounded hover:bg-muted">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="font-medium">{company.name}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Coming Soon Card */}
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">Companies Feature Coming Soon</h2>
            <p className="text-muted-foreground">
              We're working on bringing you company pages, job postings, and professional
              insights. Stay tuned for updates!
            </p>
          </div>
        </Card>

        {/* Feature Preview */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-6">
            <Building2 className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Company Profiles</h3>
            <p className="text-sm text-muted-foreground">
              Browse detailed profiles of companies in your industry
            </p>
          </Card>

          <Card className="p-6">
            <Users className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Follow Companies</h3>
            <p className="text-sm text-muted-foreground">
              Stay updated with news and job postings from companies you follow
            </p>
          </Card>

          <Card className="p-6">
            <TrendingUp className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Industry Insights</h3>
            <p className="text-sm text-muted-foreground">
              Get insights into company growth, culture, and opportunities
            </p>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Companies;
