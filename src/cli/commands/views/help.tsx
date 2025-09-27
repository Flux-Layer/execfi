// Help view component for displaying command help
import React from 'react';
import { getCommandHelp, getCommandsByCategory } from '../registry';
import type { CommandDef } from '../types';

interface HelpViewProps {
  filter?: string;
}

export function HelpView({ filter }: HelpViewProps) {
  if (filter) {
    return <CommandDetailView command={filter} />;
  }

  return <CommandListView />;
}

function CommandListView() {
  const coreCommands = getCommandsByCategory('core');
  const utilityCommands = getCommandsByCategory('utility');
  const devCommands = getCommandsByCategory('dev');

  return (
    <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
      <h2 className="text-lg font-bold mb-4">📚 Available Commands</h2>

      <div className="space-y-6">
        {coreCommands.length > 0 && (
          <CommandCategory title="Core Commands" commands={coreCommands} />
        )}

        {utilityCommands.length > 0 && (
          <CommandCategory title="Utility Commands" commands={utilityCommands} />
        )}

        {devCommands.length > 0 && (
          <CommandCategory title="Developer Commands" commands={devCommands} />
        )}
      </div>

      <div className="mt-6 p-3 bg-blue-100 rounded">
        <p className="text-blue-800 text-xs">
          💡 <strong>Tip:</strong> Use <code>/help &lt;command&gt;</code> for detailed help on any command.
          You can also use natural language like &quot;send 0.1 ETH to vitalik.eth&quot;
        </p>
      </div>
    </div>
  );
}

interface CommandCategoryProps {
  title: string;
  commands: CommandDef[];
}

function CommandCategory({ title, commands }: CommandCategoryProps) {
  return (
    <div>
      <h3 className="text-md font-semibold mb-2 text-gray-700">{title}</h3>
      <div className="grid gap-2">
        {commands.map((cmd) => (
          <div key={cmd.name} className="flex justify-between items-center p-2 bg-white rounded border">
            <div className="flex-1">
              <code className="text-blue-600 font-medium">{cmd.name}</code>
              {cmd.aliases && cmd.aliases.length > 0 && (
                <span className="text-gray-500 text-xs ml-2">
                  ({cmd.aliases.join(', ')})
                </span>
              )}
              <p className="text-gray-600 text-xs mt-1">{cmd.summary}</p>
            </div>
            <div className="text-xs text-gray-400 ml-4">
              {cmd.category}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CommandDetailViewProps {
  command: string;
}

function CommandDetailView({ command }: CommandDetailViewProps) {
  const helpText = getCommandHelp(command);

  if (!helpText) {
    return (
      <div className="p-4 bg-red-50 rounded-lg font-mono text-sm">
        <h2 className="text-lg font-bold mb-2 text-red-700">❌ Command Not Found</h2>
        <p className="text-red-600">
          No help available for command: <code>{command}</code>
        </p>
        <p className="text-red-600 mt-2">
          Use <code>/help</code> to see all available commands.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
      <div className="mb-4">
        <button
          onClick={() => window.history.back()}
          className="text-blue-600 hover:text-blue-800 text-xs"
        >
          ← Back to command list
        </button>
      </div>

      <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-white p-4 rounded border">
        {helpText}
      </pre>
    </div>
  );
}