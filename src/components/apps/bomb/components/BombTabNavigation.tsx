'use client';

export type TabType = 'game' | 'history' | 'stats';

interface BombTabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadCount?: {
    history?: number;
    stats?: number;
  };
}

export function BombTabNavigation({
  activeTab,
  onTabChange,
  unreadCount,
}: BombTabNavigationProps) {
  return (
    <>
      {/* Desktop Tab Bar */}
      <div className="hidden md:flex border-b border-gray-700 bg-gray-800">
        <TabButton
          label="Game"
          isActive={activeTab === 'game'}
          onClick={() => onTabChange('game')}
        />
        <TabButton
          label="History"
          isActive={activeTab === 'history'}
          onClick={() => onTabChange('history')}
          badge={unreadCount?.history}
        />
        <TabButton
          label="Stats"
          isActive={activeTab === 'stats'}
          onClick={() => onTabChange('stats')}
        />
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-700 bg-gray-900 pb-safe md:hidden">
        <MobileTabButton
          icon="🎮"
          label="Game"
          isActive={activeTab === 'game'}
          onClick={() => onTabChange('game')}
        />
        <MobileTabButton
          icon="📜"
          label="History"
          isActive={activeTab === 'history'}
          onClick={() => onTabChange('history')}
          badge={unreadCount?.history}
        />
        <MobileTabButton
          icon="📊"
          label="Stats"
          isActive={activeTab === 'stats'}
          onClick={() => onTabChange('stats')}
        />
      </div>
    </>
  );
}

// Desktop Tab Button
interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

function TabButton({ label, isActive, onClick, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-6 py-3 text-sm font-medium transition-colors
        ${isActive
          ? 'border-b-2 border-green-500 text-green-400'
          : 'text-gray-400 hover:text-gray-200'
        }
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {label}
      {badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

// Mobile Tab Button
interface MobileTabButtonProps {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

function MobileTabButton({ icon, label, isActive, onClick, badge }: MobileTabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-1 flex-col items-center justify-center py-2
        ${isActive ? 'text-green-400' : 'text-gray-400'}
      `}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
    >
      <span className="text-2xl">{icon}</span>
      <span className="mt-1 text-xs">{label}</span>
      {badge && badge > 0 && (
        <span className="absolute top-1 right-1/4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}
