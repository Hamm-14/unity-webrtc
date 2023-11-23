import { useEffect } from "react";

const useScript = (url, type) => {
  useEffect(() => {
    const script = document.createElement("script");
    const container = document.getElementById("container");

    script.src = url;
    script.async = true;

    if (type) {
      script.type = type;
    }

    container.appendChild(script);

    return () => {
      container.removeChild(script);
    };
  }, [url, type]);
};

export default useScript;
