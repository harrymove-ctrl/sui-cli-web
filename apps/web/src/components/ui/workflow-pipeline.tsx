import { motion } from 'framer-motion';
import { Building2, TestTube2, Rocket, CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type WorkflowStep = 'build' | 'test' | 'publish' | 'idle';
type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

interface WorkflowPipelineIndicatorProps {
  currentStep: WorkflowStep;
  completedSteps: Set<string>;
  failedSteps: Set<string>;
  progress: number;
}

interface StepNodeProps {
  icon: React.ReactNode;
  label: string;
  status: StepStatus;
  active: boolean;
}

interface FlowConnectorProps {
  active: boolean;
  animated: boolean;
}

function StepNode({ icon, label, status, active }: StepNodeProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 transition-all duration-300',
        active && 'scale-110'
      )}
    >
      {/* Icon Circle */}
      <div
        className={cn(
          'w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center',
          'border-2 transition-all duration-300',
          status === 'completed' &&
            'bg-green-500/20 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]',
          status === 'active' &&
            'bg-primary/20 border-primary shadow-[0_0_20px_rgba(77,162,255,0.4)] animate-pulse',
          status === 'failed' &&
            'bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
          status === 'pending' && 'bg-muted/20 border-muted-foreground/30'
        )}
      >
        {status === 'active' && (
          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary" />
        )}
        {status === 'completed' && (
          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
        )}
        {status === 'failed' && <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />}
        {status === 'pending' && <div className="w-5 h-5 sm:w-6 sm:h-6">{icon}</div>}
      </div>

      {/* Label */}
      <span
        className={cn(
          'text-xs sm:text-sm font-medium transition-colors',
          active && 'text-primary',
          status === 'completed' && 'text-green-500',
          status === 'failed' && 'text-red-500',
          status === 'pending' && 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

function FlowConnector({ active, animated }: FlowConnectorProps) {
  return (
    <div className="relative flex-1 h-0.5 bg-border overflow-hidden min-w-8 sm:min-w-12">
      {/* Base line */}
      <div className="absolute inset-0 bg-muted-foreground/20" />

      {/* Active progress line */}
      {active && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/50"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
      )}

      {/* Animated particle */}
      {animated && (
        <motion.div
          className="absolute w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(77,162,255,0.8)]"
          animate={{ left: ['0%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

export function WorkflowPipelineIndicator({
  currentStep,
  completedSteps,
  failedSteps,
  progress,
}: WorkflowPipelineIndicatorProps) {
  const getStepStatus = (step: string): StepStatus => {
    if (failedSteps.has(step)) return 'failed';
    if (completedSteps.has(step)) return 'completed';
    if (currentStep === step) return 'active';
    return 'pending';
  };

  const buildStatus = getStepStatus('build');
  const testStatus = getStepStatus('test');
  const publishStatus = getStepStatus('publish');

  return (
    <div
      className="relative flex items-center justify-between gap-2 sm:gap-4 p-4 sm:p-6
                  bg-gradient-to-br from-card/50 to-card/30
                  border border-primary/20 rounded-xl backdrop-blur-xl"
    >
      {/* Step 1: Build */}
      <StepNode
        icon={<Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />}
        label="Build"
        status={buildStatus}
        active={currentStep === 'build'}
      />

      {/* Connector 1 */}
      <FlowConnector
        active={currentStep === 'test' || completedSteps.has('build')}
        animated={currentStep === 'test'}
      />

      {/* Step 2: Test */}
      <StepNode
        icon={<TestTube2 className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />}
        label="Test"
        status={testStatus}
        active={currentStep === 'test'}
      />

      {/* Connector 2 */}
      <FlowConnector
        active={currentStep === 'publish' || completedSteps.has('test')}
        animated={currentStep === 'publish'}
      />

      {/* Step 3: Publish */}
      <StepNode
        icon={<Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />}
        label="Publish"
        status={publishStatus}
        active={currentStep === 'publish'}
      />
    </div>
  );
}
