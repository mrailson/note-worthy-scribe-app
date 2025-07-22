import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { AlertCircle, Clock, CheckCircle, XCircle, Search } from "lucide-react";

const ComplaintsSystem = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Mock complaints data
  const complaints = [
    {
      id: "C001",
      title: "Long waiting time",
      category: "Service",
      status: "Open",
      priority: "Medium",
      date: "2024-01-20",
      description: "Patient waited over 2 hours for appointment",
    },
    {
      id: "C002", 
      title: "Staff behavior issue",
      category: "Staff",
      status: "In Progress",
      priority: "High",
      date: "2024-01-18",
      description: "Complaint about receptionist attitude",
    },
    {
      id: "C003",
      title: "Billing error",
      category: "Billing",
      status: "Resolved",
      priority: "Low",
      date: "2024-01-15",
      description: "Incorrect charges on patient invoice",
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Open": return <AlertCircle className="h-4 w-4" />;
      case "In Progress": return <Clock className="h-4 w-4" />;
      case "Resolved": return <CheckCircle className="h-4 w-4" />;
      case "Closed": return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open": return "bg-red-100 text-red-800";
      case "In Progress": return "bg-yellow-100 text-yellow-800";
      case "Resolved": return "bg-green-100 text-green-800";
      case "Closed": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "bg-red-100 text-red-800";
      case "Medium": return "bg-yellow-100 text-yellow-800";
      case "Low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header onNewMeeting={() => {}} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Complaints Management System</h1>
          <p className="text-muted-foreground">Manage and track patient complaints and feedback</p>
        </div>

        <Tabs defaultValue="view" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="view">View Complaints</TabsTrigger>
            <TabsTrigger value="new">New Complaint</TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Search & Filter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search complaints..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All categories</SelectItem>
                        <SelectItem value="Service">Service</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Billing">Billing</SelectItem>
                        <SelectItem value="Facilities">Facilities</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedCategory("");
                        setSelectedStatus("");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Complaints List */}
            <div className="grid gap-4">
              {complaints.map((complaint) => (
                <Card key={complaint.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{complaint.title}</CardTitle>
                        <CardDescription>ID: {complaint.id} • {complaint.date}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(complaint.priority)}>
                          {complaint.priority}
                        </Badge>
                        <Badge className={getStatusColor(complaint.status)}>
                          {getStatusIcon(complaint.status)}
                          <span className="ml-1">{complaint.status}</span>
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <strong>Category:</strong> {complaint.category}
                      </p>
                      <p className="text-sm">{complaint.description}</p>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline">View Details</Button>
                        <Button size="sm" variant="outline">Update Status</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submit New Complaint</CardTitle>
                <CardDescription>Record a new patient complaint or feedback</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="complainant">Complainant Name</Label>
                    <Input id="complainant" placeholder="Enter name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact Information</Label>
                    <Input id="contact" placeholder="Phone or email" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Service">Service</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Billing">Billing</SelectItem>
                        <SelectItem value="Facilities">Facilities</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Complaint Title</Label>
                  <Input id="title" placeholder="Brief summary of the complaint" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Detailed Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Provide detailed information about the complaint..."
                    rows={6}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date of Incident</Label>
                    <Input id="date" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" placeholder="Where did this occur?" />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button>Submit Complaint</Button>
                  <Button variant="outline">Save as Draft</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ComplaintsSystem;