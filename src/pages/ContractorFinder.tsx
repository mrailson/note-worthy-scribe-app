import { useState } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Star, Phone, Mail, Globe, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ContractorFinder = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");

  // Mock data for contractors
  const contractors = [
    {
      id: 1,
      name: "Smith Construction Ltd",
      category: "General Building",
      location: "London",
      rating: 4.8,
      reviews: 156,
      description: "Experienced general contractors specializing in residential and commercial construction projects.",
      phone: "+44 20 7123 4567",
      email: "info@smithconstruction.co.uk",
      website: "www.smithconstruction.co.uk",
      specialties: ["Extensions", "Renovations", "New Builds"],
      verified: true
    },
    {
      id: 2,
      name: "Elite Plumbing Services",
      category: "Plumbing",
      location: "Manchester",
      rating: 4.9,
      reviews: 203,
      description: "Professional plumbing services for domestic and commercial properties. 24/7 emergency callouts available.",
      phone: "+44 161 234 5678",
      email: "contact@eliteplumbing.co.uk",
      website: "www.eliteplumbing.co.uk",
      specialties: ["Emergency Repairs", "Boiler Installation", "Bathroom Fitting"],
      verified: true
    },
    {
      id: 3,
      name: "Precision Electrical",
      category: "Electrical",
      location: "Birmingham",
      rating: 4.7,
      reviews: 89,
      description: "Certified electricians providing safe and reliable electrical services for homes and businesses.",
      phone: "+44 121 345 6789",
      email: "info@precisionelectrical.co.uk",
      website: "www.precisionelectrical.co.uk",
      specialties: ["Rewiring", "PAT Testing", "Smart Home Installation"],
      verified: true
    }
  ];

  const categories = [
    "General Building",
    "Plumbing",
    "Electrical",
    "Roofing",
    "Heating & Gas",
    "Painting & Decorating",
    "Landscaping",
    "Kitchen & Bathroom"
  ];

  const locations = [
    "London",
    "Manchester",
    "Birmingham",
    "Leeds",
    "Glasgow",
    "Liverpool",
    "Bristol",
    "Edinburgh"
  ];

  const filteredContractors = contractors.filter(contractor => {
    const matchesSearch = contractor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contractor.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contractor.specialties.some(specialty => 
                           specialty.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    const matchesCategory = selectedCategory === "all" || contractor.category === selectedCategory;
    const matchesLocation = selectedLocation === "all" || contractor.location === selectedLocation;
    
    return matchesSearch && matchesCategory && matchesLocation;
  });

  const handleNewMeeting = () => {
    // Navigation logic for new meeting
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Contractor Finder
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find trusted, verified contractors for your construction and maintenance projects
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search contractors, services, or specialties..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location} value={location}>{location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="mb-4">
          <p className="text-muted-foreground">
            Found {filteredContractors.length} contractor{filteredContractors.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Contractor Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredContractors.map(contractor => (
            <Card key={contractor.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {contractor.name}
                      {contractor.verified && (
                        <Badge variant="secondary" className="text-xs">
                          Verified
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {contractor.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {contractor.rating} ({contractor.reviews} reviews)
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{contractor.description}</p>
                
                <div>
                  <h4 className="font-medium mb-2">Specialties:</h4>
                  <div className="flex flex-wrap gap-2">
                    {contractor.specialties.map(specialty => (
                      <Badge key={specialty} variant="outline">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website
                  </Button>
                  <Button size="sm" className="sm:ml-auto">
                    Get Quote
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredContractors.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No contractors found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or location filters
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ContractorFinder;