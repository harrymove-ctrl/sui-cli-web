export function observeVisibility(
  element: Element,
  onChange: (active: boolean) => void,
  rootMargin = "200px"
): () => void {
  if (
    typeof IntersectionObserver === "undefined" ||
    typeof document === "undefined"
  ) {
    onChange(true);
    return () => {};
  }

  let inView = false;
  let pageVisible = !document.hidden;

  const emit = (): void => onChange(inView && pageVisible);

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      inView = entry ? entry.isIntersecting : false;
      emit();
    },
    { rootMargin }
  );
  observer.observe(element);

  const onVisibilityChange = (): void => {
    pageVisible = !document.hidden;
    emit();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
