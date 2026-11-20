import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  containerId?: string;
};

export function ScrollToTop({ containerId }: Props) {
  const [visible, setVisible] = useState(false);

  const getContainer = () =>
    containerId ? document.getElementById(containerId) : null;

  useEffect(() => {
    const container = getContainer();
    const target = container ?? window;

    const handleScroll = () => {
      const position = container ? container.scrollTop : window.scrollY;

      setVisible(position > 300);
    };

    target.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    handleScroll();

    return () => {
      target.removeEventListener("scroll", handleScroll);
    };
  }, [containerId]);

  const scrollToTop = () => {
    const container = getContainer();

    (container ?? window).scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Back to top"
      className="
        fixed bottom-6 right-6 z-50
        flex size-10 items-center justify-center
        rounded-full
        bg-[#135D66] text-[#E3FEF7]
        shadow-lg shadow-black/20
        transition-all duration-300
        hover:-translate-y-1 hover:scale-110
        hover:bg-[#003C43]
        hover:shadow-xl
        active:scale-95
        animate-bounce motion-reduce:animate-none
        dark:bg-[#77B0AA]
        dark:text-[#003C43]
        dark:hover:bg-[#E3FEF7]
        sm:bottom-8 sm:right-8
      "
    >
      <ArrowUp size={16} strokeWidth={2.5} />
    </button>
  );
}
