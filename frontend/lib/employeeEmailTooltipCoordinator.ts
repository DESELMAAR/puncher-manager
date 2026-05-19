type Listener = (activeId: string | null) => void;

let activeId: string | null = null;
const listeners = new Set<Listener>();

export function getActiveEmployeeEmailTooltip() {
  return activeId;
}

export function setActiveEmployeeEmailTooltip(id: string | null) {
  activeId = id;
  listeners.forEach((listener) => listener(activeId));
}

export function subscribeEmployeeEmailTooltip(listener: Listener): () => void {
  listeners.add(listener);
  listener(activeId);
  return () => {
    listeners.delete(listener);
  };
}
