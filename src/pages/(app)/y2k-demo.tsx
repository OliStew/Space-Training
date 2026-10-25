import { useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/Y2kUiComp';
import '@/components/Y2kUiComp/styles.css';

export default function Y2kDemoPage() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'y2k');
    return () => {
      document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Y2K Component Demo</h1>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Various button styles from the Y2K component library</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button>Default</Button>
          <Button variant='secondary'>Secondary</Button>
          <Button variant='destructive'>Destructive</Button>
          <Button variant='outline'>Outline</Button>
          <Button variant='ghost'>Ghost</Button>
          <Button variant='link'>Link</Button>
          <Button disabled>Disabled</Button>
        </CardContent>
      </Card>

      <div style={{ height: 24 }} />

      <Card>
        <CardHeader>
          <CardTitle>Form Controls</CardTitle>
          <CardDescription>Inputs, labels, checkboxes, and selects</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label htmlFor='demo-input'>Text Input</Label>
            <Input id='demo-input' placeholder='Type something...' />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox id='demo-checkbox' />
            <Label htmlFor='demo-checkbox'>Checkbox label</Label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>Select</Label>
            <Select>
              <SelectTrigger style={{ width: 200 }}>
                <SelectValue placeholder='Select an option' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='option1'>Option 1</SelectItem>
                <SelectItem value='option2'>Option 2</SelectItem>
                <SelectItem value='option3'>Option 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div style={{ height: 24 }} />

      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Status indicators and labels</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge>Default</Badge>
          <Badge variant='secondary'>Secondary</Badge>
          <Badge variant='destructive'>Destructive</Badge>
          <Badge variant='outline'>Outline</Badge>
        </CardContent>
      </Card>

      <div style={{ height: 24 }} />

      <Card>
        <CardHeader>
          <CardTitle>Tabs</CardTitle>
          <CardDescription>Tabbed content navigation</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='tab1'>
            <TabsList>
              <TabsTrigger value='tab1'>Tab 1</TabsTrigger>
              <TabsTrigger value='tab2'>Tab 2</TabsTrigger>
              <TabsTrigger value='tab3'>Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value='tab1' style={{ padding: 16, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginTop: 12 }}>
              Content for Tab 1
            </TabsContent>
            <TabsContent value='tab2' style={{ padding: 16, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginTop: 12 }}>
              Content for Tab 2
            </TabsContent>
            <TabsContent value='tab3' style={{ padding: 16, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginTop: 12 }}>
              Content for Tab 3
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
