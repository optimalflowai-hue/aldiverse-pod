import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received Lulu Webhook Event:', JSON.stringify(body));

    // Parse Lulu PRINT_JOB_STATUS_CHANGED webhook payload
    // Actual structure: { topic: "...", data: { id: 123, status: { name: "SHIPPED", line_item_statuses: [...] } } }
    const luluJobId = body.data?.id?.toString();
    const luluStatus = body.data?.status?.name; // e.g., "SHIPPED", "IN_PRODUCTION", "CANCELED"
    const lineItemStatuses = body.data?.status?.line_item_statuses;

    if (!luluJobId) {
      console.warn('Lulu webhook received but missing data.id');
      return NextResponse.json({ error: 'Missing print_job_id' }, { status: 400 });
    }

    // Map Lulu status to our platform database status enum
    // ('pending', 'paid', 'submitted_to_lulu', 'printing', 'shipped', 'cancelled')
    let dbStatus = 'submitted_to_lulu';
    if (luluStatus === 'SHIPPED') {
      dbStatus = 'shipped';
    } else if (['PRODUCTION_READY', 'IN_PRODUCTION', 'PRODUCTION_DELAYED'].includes(luluStatus)) {
      dbStatus = 'printing';
    } else if (['REJECTED', 'ERROR', 'CANCELED'].includes(luluStatus)) {
      dbStatus = 'cancelled';
    }

    // Extract tracking number if shipped
    let trackingNumber: string | undefined;
    if (luluStatus === 'SHIPPED' && lineItemStatuses?.length > 0) {
      const trackingId = lineItemStatuses[0]?.messages?.tracking_id;
      if (trackingId) {
        trackingNumber = trackingId.toString();
      }
    }

    const updatePayload: any = {
      lulu_status: luluStatus,
      status: dbStatus,
    };

    if (trackingNumber) {
      updatePayload.tracking_number = trackingNumber;
    }

    // Update matching order rows in database
    const { data: updatedOrders, error: updateError } = await supabaseServer
      .from('orders')
      .update(updatePayload)
      .eq('lulu_job_id', luluJobId)
      .select();

    if (updateError) {
      console.error(`Database error updating Lulu Job ID ${luluJobId}:`, updateError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    if (!updatedOrders || updatedOrders.length === 0) {
      console.warn(`Lulu webhook received for job ID ${luluJobId} but no matching order was found in database.`);
    } else {
      console.log(`Updated ${updatedOrders.length} order(s) for Lulu Job ID ${luluJobId} to status "${dbStatus}"`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Unhandled error inside Lulu webhook router:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
