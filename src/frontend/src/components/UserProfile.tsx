import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@loanvision/shared/components/ui/dropdown-menu";
import { useAuth } from "../contexts/AuthContext";
import { UserCircle, LogOut } from "lucide-react"; // Import necessary icons

export function UserProfile() {
  const { user, logout } = useAuth();

  if (!user) {
    return null; // Render nothing if the user is not loaded
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:bg-slate-100 focus:outline-none">
          <UserCircle className="h-8 w-8 text-slate-400" />
          <div className="text-left">
            <p className="font-semibold text-slate-800">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-slate-500 capitalize">{user.role?.replace('_', ' ')}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Future items like "Settings" or "Profile" can be added here */}
        <DropdownMenuItem onClick={logout} className="group text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}