import { useEffect } from "react";

export const PageInfo = () => {
  useEffect(() => {
    const eventSource = new EventSource(`/api/assistant`);

    const messageListener = (event) => {
      console.log(event.data);
    };
    const closeListener = () => {
      return eventSource.close();
    };
    // Close the connection to SSE API if any error
    eventSource.addEventListener("error", closeListener);
    // Listen to events received via the SSE API
    eventSource.addEventListener("message", messageListener);

    // As the component unmounts, close listeners to SSE API
    return () => {
      eventSource.removeEventListener("error", closeListener);
      eventSource.removeEventListener("message", messageListener);
      eventSource.close();
    };
  }, []);

  return <div>All the action is happening in the console</div>;
};
