import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button component", () => {
  it("should render with default variant", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it("should render with text content", () => {
    render(<Button>Criar Proposta</Button>);
    expect(screen.getByText("Criar Proposta")).toBeInTheDocument();
  });

  it("should call onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("should not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("should apply custom className", () => {
    render(<Button className="custom-class">Button</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });

  it("should render different sizes", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-12");

    rerender(<Button size="xl">Extra Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-14");
  });

  it("should render destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-destructive");
  });

  it("should render outline variant", () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("border-2");
  });

  it("should render whatsapp variant", () => {
    render(<Button variant="whatsapp">WhatsApp</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-[#25D366]");
  });

  it("should render ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("hover:bg-primary/10");
  });

  it("should support type attribute", () => {
    render(<Button type="submit">Submit</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("should forward ref correctly", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref Button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
