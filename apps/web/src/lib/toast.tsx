import toast from 'react-hot-toast';

interface ToastErrorOptions {
  message: string;
  hint?: string;
  icon?: string;
}

interface ToastSuccessOptions {
  message: string;
  details?: string;
  icon?: string;
}

/**
 * Display a beautiful error toast with optional action hint
 */
export function showErrorToast({ message, hint, icon = '❌' }: ToastErrorOptions) {
  return toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-sm shadow-xl rounded-xl pointer-events-auto flex border border-red-500/30`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-400 mb-1">
                {message}
              </p>
              {hint && (
                <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 text-sm flex-shrink-0">💡</span>
                    <p className="text-xs text-yellow-300/90 leading-relaxed">
                      {hint}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex border-l border-red-500/20">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    ),
    { duration: 5000 }
  );
}

/**
 * Display a beautiful success toast with optional details
 */
export function showSuccessToast({ message, details, icon = '🎉' }: ToastSuccessOptions) {
  return toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm shadow-xl rounded-xl pointer-events-auto flex border border-green-500/30`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-400 mb-1">
                {message}
              </p>
              {details && (
                <p className="text-xs text-green-300/80 mt-1 leading-relaxed">
                  {details}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex border-l border-green-500/20">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    ),
    { duration: 4000 }
  );
}

/**
 * Display a beautiful info toast
 */
export function showInfoToast({ message, icon = 'ℹ️' }: { message: string; icon?: string }) {
  return toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm shadow-xl rounded-xl pointer-events-auto flex border border-blue-500/30`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-300 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-blue-500/20">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    ),
    { duration: 3000 }
  );
}
