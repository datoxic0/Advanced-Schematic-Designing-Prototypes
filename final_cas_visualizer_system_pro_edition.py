# FINAL SYSTEM: Pro Mathematical Engine
# Combines CAS, visualization, analysis, and reporting

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import numpy as np
import sympy as sp
import matplotlib.pyplot as plt

from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations,
    implicit_multiplication_application, convert_xor
)

# -------- CONFIG --------
TAU = getattr(sp, "tau", 2 * sp.pi)
TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)

# -------- UTILITIES --------
def normalize(expr):
    rep = {
        "×": "*", "÷": "/", "π": "pi", "τ": "TAU",
        "√(": "sqrt(", "^": "**"
    }
    for k, v in rep.items():
        expr = expr.replace(k, v)
    return expr


def safe_array(y, shape):
    y = np.asarray(y)
    if y.ndim == 0 or y.size == 1:
        return np.full(shape, float(y))
    try:
        return y.astype(float)
    except:
        return np.full(shape, np.nan)

# -------- CORE ENGINE --------
class MathEngine:
    def __init__(self, a_value):
        self.x, self.y, self.t, self.a = sp.symbols("x y t a")
        self.a_val = a_value

    def parse(self, text):
        text = normalize(text)
        local = {
            "x": self.x, "y": self.y, "t": self.t,
            "a": self.a_val,
            "pi": sp.pi, "TAU": TAU,
            "sin": sp.sin, "cos": sp.cos, "tan": sp.tan,
            "log": sp.log, "exp": sp.exp, "sqrt": sp.sqrt
        }
        return parse_expr(text, local_dict=local, transformations=TRANSFORMATIONS)

    def analyze(self, expr):
        results = {}

        try:
            results["simplified"] = sp.simplify(expr)
        except:
            results["simplified"] = expr

        try:
            results["derivative"] = sp.diff(expr, self.x)
        except:
            results["derivative"] = None

        try:
            results["integral"] = sp.integrate(expr, self.x)
        except:
            results["integral"] = None

        try:
            results["roots"] = sp.solve(expr, self.x)
        except:
            results["roots"] = []

        try:
            results["limits"] = (
                sp.limit(expr, self.x, sp.oo),
                sp.limit(expr, self.x, -sp.oo)
            )
        except:
            results["limits"] = (None, None)

        results["latex"] = sp.latex(expr)

        return results

# -------- MAIN APP --------
class FinalSystem(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Final Mathematical System")
        self.geometry("1400x900")

        self.mode = tk.StringVar(value="2D")
        self.history = []
        self.a_val = tk.DoubleVar(value=1.0)

        self.build_ui()

    def build_ui(self):
        top = ttk.Frame(self)
        top.pack(fill="x", padx=10, pady=5)

        self.entry = ttk.Entry(top, width=80)
        self.entry.pack(side="left", expand=True, fill="x")

        ttk.Button(top, text="Compute", command=self.compute).pack(side="left", padx=5)

        ttk.OptionMenu(top, self.mode, "2D", "2D", "3D", "Parametric", "Polar").pack(side="left")

        ttk.Scale(top, from_=-10, to=10, variable=self.a_val, command=lambda e: self.compute()).pack(side="left", padx=10)

        ttk.Button(top, text="Export LaTeX", command=self.export_latex).pack(side="left")

        # history
        self.listbox = tk.Listbox(self, height=5)
        self.listbox.pack(fill="x")
        self.listbox.bind("<<ListboxSelect>>", self.load_history)

        # info panel
        self.info = tk.Text(self, height=10)
        self.info.pack(fill="x")

        # plot
        self.fig = plt.figure(figsize=(10,6))
        self.ax = self.fig.add_subplot(111)

        self.canvas = FigureCanvasTkAgg(self.fig, master=self)
        self.canvas.get_tk_widget().pack(fill="both", expand=True)

        NavigationToolbar2Tk(self.canvas, self)

    def load_history(self, e):
        if not self.listbox.curselection(): return
        idx = self.listbox.curselection()[0]
        self.entry.delete(0, tk.END)
        self.entry.insert(0, self.history[idx])

    def compute(self):
        text = self.entry.get().strip()
        if not text: return

        self.history.append(text)
        self.listbox.insert(tk.END, text)

        engine = MathEngine(self.a_val.get())

        try:
            expr = engine.parse(text)
        except Exception as e:
            messagebox.showerror("Parse Error", str(e))
            return

        results = engine.analyze(expr)

        self.fig.clf()

        try:
            if self.mode.get() == "2D":
                self.ax = self.fig.add_subplot(111)
                xs = np.linspace(-10, 10, 2000)
                f = sp.lambdify(engine.x, expr, "numpy")
                ys = safe_array(f(xs), xs.shape)
                mask = np.isfinite(ys)
                self.ax.plot(xs[mask], ys[mask])

            elif self.mode.get() == "3D":
                self.ax = self.fig.add_subplot(111, projection='3d')
                X = np.linspace(-5,5,100)
                Y = np.linspace(-5,5,100)
                X,Y = np.meshgrid(X,Y)
                f = sp.lambdify((engine.x, engine.y), expr, "numpy")
                Z = safe_array(f(X,Y), X.shape)
                self.ax.plot_surface(X,Y,Z)

            self.ax.set_title(str(expr))
            self.ax.grid(True)
            self.canvas.draw()

        except Exception as e:
            messagebox.showerror("Plot Error", str(e))

        # info
        info_text = f"""
Expression: {expr}
Simplified: {results['simplified']}
Derivative: {results['derivative']}
Integral: {results['integral']}
Roots: {results['roots']}
Limits: {results['limits']}
LaTeX: {results['latex']}
"""

        self.info.delete("1.0", tk.END)
        self.info.insert(tk.END, info_text)

    def export_latex(self):
        content = self.info.get("1.0", tk.END)
        file = filedialog.asksaveasfilename(defaultextension=".tex")
        if not file: return
        with open(file, "w") as f:
            f.write(content)
        messagebox.showinfo("Export", "LaTeX file saved.")


if __name__ == "__main__":
    app = FinalSystem()
    app.mainloop()
