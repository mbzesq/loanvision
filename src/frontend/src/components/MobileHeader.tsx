// src/frontend/src/components/MobileHeader.tsx
import { Button } from '@loanvision/shared/components/ui/button';
import { Menu } from 'lucide-react';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>
      <h1 className="text-lg font-bold">NPLVision</h1>
    </header>
  );
}