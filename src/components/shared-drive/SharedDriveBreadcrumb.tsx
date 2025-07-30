import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Home, ChevronRight } from "lucide-react";

interface SharedDriveFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  path: string;
}

interface SharedDriveBreadcrumbProps {
  path: SharedDriveFolder[];
  onNavigate: (folderId: string | null) => void;
}

export function SharedDriveBreadcrumb({ path, onNavigate }: SharedDriveBreadcrumbProps) {
  return (
    <div className="border-b px-4 py-3 bg-background">
      <Breadcrumb>
        <BreadcrumbList>
          {/* Home/Root folder */}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate(null)}
                className="h-auto p-1 font-normal"
              >
                <Home className="h-4 w-4 mr-1" />
                Shared Drive
              </Button>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {/* Path folders */}
          {path.map((folder, index) => (
            <div key={folder.id} className="flex items-center">
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate(folder.id)}
                    className="h-auto p-1 font-normal"
                  >
                    {folder.name}
                  </Button>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}