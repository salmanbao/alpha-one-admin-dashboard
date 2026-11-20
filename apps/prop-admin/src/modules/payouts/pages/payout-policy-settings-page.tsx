"use client";

import { useState, useEffect } from "react";
import { SettingsPage } from "@/modules/settings/settings-page";
import { usePlatform } from "@/lib/platform/platform-context";
import { Input } from "@/components/ui/input";
import { CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";;
import { useMemo } from "react";

export default function PayoutPolicySettingsPage() {
  const { tenant } = usePlatform();
  const [policy, setPolicy] = useState<{
    minimumRequest: number;
    maximumRequest: number;
    cadenceDays: number;
    processingFee: number;
    methodEnabled: boolean;
  }>({
    minimumRequest: 100,
    maximumRequest: 25000,
    cadenceDays: 14,
    processingFee: 20,
    methodEnabled: true,
  } as any);

  // Load tenant settings if available
  useEffect(() => {
    // In a real implementation, this would fetch from tenant settings
    // For now, we'll keep the default values
  }, []);

  const handleChange = (field: keyof typeof policy) => (value: string | number) => {
    setPolicy(prev => ({
      ...prev,
      [field]: typeof value === "number" 
        ? value 
        : field === "methodEnabled" 
          ? value === "true" 
            ? true 
            : false 
          : value,
    }));
  };

  const isValid = useMemo(() => {
    return policy.minimumRequest > 0 && 
           policy.maximumRequest >= policy.minimumRequest && 
           policy.cadenceDays > 0 &&
           policy.processingFee >= 0;
  }, [policy]);

  const saveSettings = () => {
    // In a real implementation, this would save to tenant settings
    // For now, we'll just show a success message
    alert("Payout policy settings saved successfully!");
  };

  return (
    <SettingsPage>
      <Card className="p-6">
        <CardHeader>
          <CardTitle>Payout Policy Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div>
              <Label className="block text-sm font-medium text-gray-700">Minimum Request Amount</Label>
              <Input 
                type="number" 
                className="mt-1 w-full rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                value={policy.minimumRequest}
                onChange={handleChange('minimumRequest')}
                min={0}
                step={1}
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <Label className="block text-sm font-medium text-gray-700">Maximum Request Amount</Label>
              <Input 
                type="number" 
                className="mt-1 w-full rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                value={policy.maximumRequest}
                onChange={handleChange('maximumRequest')}
                min={0}
                step={1}
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <Label className="block text-sm font-medium text-gray-700">Payout Cadence</Label>
              <Input 
                type="number" 
                className="mt-1 w-full rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                value={policy.cadenceDays}
                onChange={handleChange('cadenceDays')}
                min={1}
              />
              <Label className="block text-sm text-gray-700">days</Label>
            </div>
            
            <div className="flex items-center space-x-4">
              <Label className="block text-sm font-medium text-gray-700">Processing Fee</Label>
              <Input 
                type="number" 
                className="mt-1 w-full rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                value={policy.processingFee}
                onChange={handleChange('processingFee')}
                min={0}
              />
              <Label className="block text-sm text-gray-700">% fee</Label>
            </div>
            
            <div className="flex items-center space-x-4">
              <Label className="block text-sm font-medium text-gray-700">Enable Payout Method</Label>
              <Switch 
                checked={policy.methodEnabled}
                onChange={handleChange('methodEnabled')}
                className="w-5 h-7"
              />
            </div>
          </div>
          
          <div className="pt-6">
            <Button 
              variant="primary" 
              onClick={saveSettings}
              className="w-full"
            >
              Save Payout Policy Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </SettingsPage>
  );
}

interface SettingsPageProps {
  // Props are handled by the SettingsPage component
}
