import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IconSelectorProps {
  value: string;
  onChange: (icon: string) => void;
}

// Common icons for furniture/fixtures
const commonIcons = [
  'box', 'sofa', 'bed', 'armchair', 'lamp', 'lamp-desk', 'lamp-floor',
  'table', 'square', 'rectangle-horizontal', 'rectangle-vertical',
  'circle', 'triangle', 'hexagon', 'octagon',
  'tv', 'monitor', 'refrigerator', 'microwave', 'cooking-pot',
  'bath', 'shower-head', 'droplet', 'droplets',
  'toilet', 'pipette', 'plug', 'plug-2',
  'fan', 'air-vent', 'thermometer',
  'door-open', 'door-closed', 'archive', 'cabinet',
  'book-open', 'library', 'bookshelf',
  'flower', 'flower-2', 'trees', 'palmtree',
  'car', 'bike', 'footprints',
  'shirt', 'hanger',
];

const IconSelector = ({ value, onChange }: IconSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Get the icon component
  const getIconComponent = (iconName: string) => {
    const pascalCase = iconName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    return (LucideIcons as any)[pascalCase];
  };

  const CurrentIcon = getIconComponent(value) || LucideIcons.Box;

  // Filter icons based on search
  const filteredIcons = search
    ? commonIcons.filter(icon => icon.toLowerCase().includes(search.toLowerCase()))
    : commonIcons;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-3">
          <CurrentIcon className="w-4 h-4" />
          <span className="flex-1 text-left font-mono text-sm">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <ScrollArea className="h-64 p-3">
          <div className="grid grid-cols-6 gap-2">
            {filteredIcons.map((iconName) => {
              const IconComponent = getIconComponent(iconName);
              if (!IconComponent) return null;
              
              return (
                <Button
                  key={iconName}
                  variant={value === iconName ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => {
                    onChange(iconName);
                    setOpen(false);
                    setSearch('');
                  }}
                  title={iconName}
                >
                  <IconComponent className="w-4 h-4" />
                </Button>
              );
            })}
          </div>
          {filteredIcons.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No icons found
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default IconSelector;
