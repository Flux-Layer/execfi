const TerminalHeader = ({
  headerTitle,
  isSessionActive
}: {
  headerTitle: string;
  isSessionActive?: boolean;
}) => {
    return (
      <div className="w-full p-3 bg-slate-700 flex items-center gap-1 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </div>
        <span className="text-sm text-slate-200 font-semibold absolute left-[50%] -translate-x-[50%]">

          {headerTitle || ""}
        </span>
        <div className="flex items-center gap-2">
          {isSessionActive && (
            <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">
              🔑 Session Active
            </span>
          )}
        </div>
      </div>
    );
  };
  
  export default TerminalHeader;
  
