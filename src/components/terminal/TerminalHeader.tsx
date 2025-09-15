const TerminalHeader = ({ headerTitle }: { headerTitle: string }) => {
    return (
      <div className="w-full p-3 bg-slate-900 flex items-center gap-1 sticky top-0">
        <span className="text-sm text-slate-200 font-semibold absolute left-[50%] -translate-x-[50%]">
          {headerTitle || ""}
        </span>
      </div>
    );
  };
  
  export default TerminalHeader;
  