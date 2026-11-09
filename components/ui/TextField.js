import React, { forwardRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";
import { colors, radii, spacing, type } from "../../theme";

/**
 * Labelled text input: label above, soft filled field, brand-coloured focus
 * ring, optional helper/error line below. Forwards its ref to the TextInput
 * so modals can autofocus it.
 */
const TextField = forwardRef(function TextField(
  {
    label,
    helper,
    error,
    multiline = false,
    minHeight,
    editable = true,
    style,
    inputStyle,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        editable={editable}
        accessibilityLabel={inputProps.accessibilityLabel || label || inputProps.placeholder}
        textAlignVertical={multiline ? "top" : "center"}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && { minHeight: minHeight || 96, paddingTop: 12 },
          focused && styles.focused,
          !!error && styles.errored,
          !editable && styles.locked,
          inputStyle,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

export default TextField;

/** Section label used inside forms (e.g. "Due", "Days"). */
export function FieldLabel({ children, style }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  label: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
    marginLeft: 2,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    // The focus ring is our own border; drop the browser outline on web.
    ...Platform.select({ web: { outlineStyle: "none" }, default: {} }),
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  errored: {
    borderColor: colors.danger,
  },
  locked: {
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSunken,
  },
  helper: {
    ...type.footnote,
    marginTop: spacing.xs + 2,
    marginLeft: 2,
  },
  error: {
    ...type.footnote,
    color: colors.dangerText,
    marginTop: spacing.xs + 2,
    marginLeft: 2,
  },
});
