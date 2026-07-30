import React, { useEffect, useRef, useState } from "react";

// Controlled inputs whose value round-trips through JSON.stringify/parse on every
// keystroke - the whole editor config is re-serialised - come back as a NEW string
// a tick later. React then rewrites the DOM value and the browser drops the caret
// to the end, so typing into the middle of a rule comment is impossible.
//
// The fix is to hold the text locally while the field has focus and only accept
// the upstream value again on blur. Edits still propagate immediately via
// onChange; it is only the echo back that is ignored.

export const StableInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  type?: string;
}> = ({ value, onChange, placeholder, className, onClick, type }) => {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);
  return (
    <input
      type={type}
      className={className}
      placeholder={placeholder}
      value={local}
      onClick={onClick}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setLocal(value);
      }}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
};

export const StableTextArea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);
  return (
    <textarea
      placeholder={placeholder}
      value={local}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setLocal(value);
      }}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
};
